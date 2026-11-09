"use client";

import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { parseMoney } from "@/shared/domain/money";
import { button } from "@/shared/ui/button";
import { Dialog, DialogActions } from "@/shared/ui/dialog";
import { describedBy, Field, FIELD, FormError, MoneyInput } from "@/shared/ui/field";
import { brl, decimal, monthShort } from "@/shared/ui/format";

import type { ExpenseDTO } from "../../application/expenses";
import { MAX_INSTALLMENTS, splitAmount } from "../../domain/installments";
import { createExpense, deleteExpense, updateExpense } from "../actions";

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
  // Parcelas de faturas já vencidas ficam fora (pagas antes do FinFlow): o cronograma começa depois delas.
  const skipped = first.number - 1;
  const outside =
    skipped > 0
      ? ` · ${skipped} ${skipped === 1 ? "parcela já vencida ficou" : "parcelas já vencidas ficaram"} de fora`
      : "";
  return `${brl(e.totalCents)} em ${e.installments}x de ${brl(last.amountCents)} · ${shortRef(first.referenceMonth)} → ${shortRef(last.referenceMonth)}${outside}`;
}

/** RF-032: parcela em fatura fechada trava valor, data, cartão e parcelas (corrige-se com ajuste). */
export const hasLockedInstallments = (e: Pick<ExpenseDTO, "schedule">) =>
  e.schedule.some((s) => s.invoiceStatus !== "OPEN");

interface Lists {
  cards: Option[];
  categories: Option[];
  today: string;
}

/**
 * Despesa à vista ou parcelada (FLOW_MAP §7, RF-030/RF-031): todas as parcelas são lançadas ao salvar.
 * Com `expense`, edita (RF-032): mudar valor, data, cartão ou parcelas relança todas as parcelas.
 */
export function ExpenseForm({
  cards,
  categories,
  today,
  expense,
  onDone,
  onSaved,
}: Lists & {
  expense?: ExpenseDTO;
  onDone: () => void;
  onSaved?: (message: string) => void;
}) {
  const [v, setV] = useState(
    expense
      ? {
          description: expense.description,
          total: decimal(expense.totalCents),
          installments: String(expense.installments),
          purchaseDate: expense.purchaseDate,
          cardId: expense.cardId,
          categoryId: expense.categoryId ?? "",
        }
      : {
          description: "",
          total: "",
          installments: "1",
          purchaseDate: today,
          cardId: cards[0]?.id ?? "",
          categoryId: "",
        },
  );
  const locked = expense ? hasLockedInstallments(expense) : false;
  // O cartão de uma despesa pode ter sido arquivado: continua visível no seletor travado.
  const cardOptions =
    expense && !cards.some((c) => c.id === expense.cardId)
      ? [...cards, { id: expense.cardId, name: "Cartão arquivado" }]
      : cards;
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
    const res = expense
      ? await updateExpense({
          id: expense.id,
          expectedUpdatedAt: expense.updatedAt,
          description: v.description,
          categoryId: v.categoryId || null,
          ...(locked
            ? {}
            : { total: v.total, installments: n, purchaseDate: v.purchaseDate, cardId: v.cardId }),
        })
      : await createExpense({
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
      {locked && (
        <p className="rounded-md bg-status-warning p-3 text-body-sm text-status-warning-fg">
          Há parcelas em faturas já fechadas, então valor, data, cartão e parcelas não mudam aqui. Para
          corrigir o valor, lance um ajuste na fatura.
        </p>
      )}
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
            disabled={locked}
          />
        </Field>
        <Field id="despesa-parcelas" label="Parcelas" error={err("installments")}>
          <select
            {...describedBy("despesa-parcelas", err("installments"), preview)}
            value={v.installments}
            onChange={set("installments")}
            disabled={locked}
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
            disabled={locked}
            required
            className={FIELD}
          />
        </Field>
        <Field id="despesa-cartao" label="Cartão" error={err("cardId")}>
          <select
            {...describedBy("despesa-cartao", err("cardId"))}
            value={v.cardId}
            onChange={set("cardId")}
            disabled={locked}
            className={FIELD}
          >
            {cardOptions.map((c) => (
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
          {expense ? "Salvar alterações" : "Lançar despesa"}
        </button>
      </DialogActions>
    </form>
  );
}

export function NewExpenseButton({
  className,
  children,
  ...lists
}: Lists & { className: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Plus aria-hidden size={18} strokeWidth={1.5} />
        {children ?? "Nova despesa"}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Nova despesa">
        <ExpenseForm {...lists} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function EditExpenseButton({ expense, ...lists }: Lists & { expense: ExpenseDTO }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Editar ${expense.description}`}
        className={button("ghost", "sm")}
      >
        <Pencil aria-hidden size={16} strokeWidth={1.5} />
        <span className="max-sm:sr-only">Editar</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Editar despesa">
        <ExpenseForm {...lists} expense={expense} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

/** RF-033: excluir remove todas as parcelas; com parcela em fatura fechada, pede confirmação explícita. */
export function DeleteExpenseButton({ expense }: { expense: ExpenseDTO }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locked = hasLockedInstallments(expense);
  const close = () => {
    setOpen(false);
    setMessage(null);
  };

  async function onConfirm() {
    setBusy(true);
    const res = await deleteExpense({ id: expense.id, confirmClosedInvoices: locked });
    setBusy(false);
    if (res.ok) return close();
    setMessage(res.error.message);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Excluir ${expense.description}`}
        className={button("ghost", "sm")}
      >
        <Trash2 aria-hidden size={16} strokeWidth={1.5} />
        <span className="max-sm:sr-only">Excluir</span>
      </button>
      <Dialog open={open} onClose={close} title="Excluir despesa?">
        <p className="text-body text-fg-muted">
          {expense.installments > 1
            ? `As ${expense.installments} parcelas de ${expense.description} saem das faturas.`
            : `${expense.description} sai da fatura.`}
        </p>
        {locked && (
          <p className="mt-3 rounded-md bg-status-warning p-3 text-body-sm text-status-warning-fg">
            Algumas parcelas estão em faturas já fechadas, e o total delas vai mudar.
          </p>
        )}
        {message && (
          <div className="mt-4">
            <FormError>{message}</FormError>
          </div>
        )}
        <DialogActions>
          <button type="button" onClick={close} className={button("ghost", "md")}>
            Voltar
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={button("danger", "md")}>
            {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
            Excluir despesa
          </button>
        </DialogActions>
      </Dialog>
    </>
  );
}
