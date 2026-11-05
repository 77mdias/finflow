"use client";

import { LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { parseMoney } from "@/shared/domain/money";
import { button } from "@/shared/ui/button";
import { DialogActions } from "@/shared/ui/dialog";
import { describedBy, Field, FIELD, FormError, MoneyInput } from "@/shared/ui/field";
import { brl, monthShort } from "@/shared/ui/format";

import type { ExpenseDTO } from "../../application/expenses";
import { MAX_INSTALLMENTS, splitAmount } from "../../domain/installments";
import { createExpense } from "../actions";

interface Option {
  id: string;
  name: string;
}

/** Prévia das parcelas; `null` enquanto o valor não é válido. */
function split(total: string, n: number): { base: number; first: number } | null {
  try {
    const cents = parseMoney(total);
    if (cents <= 0n) return null;
    const { base, first } = splitAmount(cents, n);
    return { base: Number(base), first: Number(first) };
  } catch {
    return null;
  }
}

/** "2026-12" → "dez/26" */
const shortRef = (ym: string) => `${monthShort(ym)}/${ym.slice(2, 4)}`;

/** FLOW_MAP §7: "R$ 1.200,00 em 6x de R$ 200,00 · dez/26 → mai/27". */
function savedMessage(e: ExpenseDTO): string {
  const first = e.schedule[0]!;
  const last = e.schedule.at(-1)!;
  if (e.installments === 1)
    return `${brl(e.totalCents)} lançado na fatura de ${shortRef(first.referenceMonth)}`;
  return `${brl(e.totalCents)} em ${e.installments}x de ${brl(last.amountCents)} · ${shortRef(first.referenceMonth)} → ${shortRef(last.referenceMonth)}`;
}

/** Despesa à vista ou parcelada (FLOW_MAP §7, RF-030/RF-031): todas as parcelas são lançadas ao salvar. */
export function ExpenseForm({
  cards,
  categories,
  today,
  onDone,
  onSaved,
}: {
  cards: Option[];
  categories: Option[];
  today: string;
  onDone: () => void;
  onSaved?: (message: string) => void;
}) {
  const [v, setV] = useState({
    description: "",
    total: "",
    installments: "1",
    purchaseDate: today,
    cardId: cards[0]?.id ?? "",
    categoryId: "",
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => {
    setV((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };
  const err = (key: string) => errors[key]?.[0];
  const n = Number(v.installments);
  const parts = n > 1 ? split(v.total, n) : null;
  const preview = parts
    ? `${n}x de ${brl(parts.base)}${parts.first !== parts.base ? ` (a 1ª de ${brl(parts.first)})` : ""}`
    : undefined;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createExpense({
      description: v.description,
      total: v.total,
      installments: n,
      purchaseDate: v.purchaseDate,
      cardId: v.cardId,
      categoryId: v.categoryId || undefined,
    });
    setBusy(false);
    if (res.ok) {
      onSaved?.(savedMessage(res.data));
      return onDone();
    }
    setErrors(res.error.fieldErrors ?? {});
    setMessage(res.error.code === "VALIDATION_ERROR" ? null : res.error.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field id="despesa-descricao" label="Descrição" error={err("description")}>
        <input
          {...describedBy("despesa-descricao", err("description"))}
          value={v.description}
          onChange={set("description")}
          required
          maxLength={120}
          autoComplete="off"
          placeholder="Ex.: Fone de ouvido"
          className={FIELD}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id="despesa-valor" label="Valor total" error={err("total")}>
          <MoneyInput
            {...describedBy("despesa-valor", err("total"))}
            value={v.total}
            onChange={set("total")}
            required
          />
        </Field>
        <Field id="despesa-parcelas" label="Parcelas" error={err("installments")}>
          <select
            {...describedBy("despesa-parcelas", err("installments"), preview)}
            value={v.installments}
            onChange={set("installments")}
            className={FIELD}
          >
            {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i === 0 ? "À vista" : `${i + 1}x`}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {preview && (
        <p id="despesa-parcelas-ajuda" className="-mt-2 text-body-sm text-fg-muted tabular-nums">
          {preview}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field id="despesa-data" label="Data da compra" error={err("purchaseDate")}>
          <input
            {...describedBy("despesa-data", err("purchaseDate"))}
            type="date"
            value={v.purchaseDate}
            onChange={set("purchaseDate")}
            required
            className={FIELD}
          />
        </Field>
        <Field id="despesa-cartao" label="Cartão" error={err("cardId")}>
          <select
            {...describedBy("despesa-cartao", err("cardId"))}
            value={v.cardId}
            onChange={set("cardId")}
            className={FIELD}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="despesa-categoria" label="Categoria" error={err("categoryId")} hint="Opcional">
        <select
          {...describedBy("despesa-categoria", err("categoryId"), "Opcional")}
          value={v.categoryId}
          onChange={set("categoryId")}
          className={FIELD}
        >
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      {message && <FormError>{message}</FormError>}

      <DialogActions>
        <button type="button" onClick={onDone} className={button("ghost", "md")}>
          Cancelar
        </button>
        <button type="submit" disabled={busy} className={button("primary", "md")}>
          {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
          Lançar despesa
        </button>
      </DialogActions>
    </form>
  );
}
