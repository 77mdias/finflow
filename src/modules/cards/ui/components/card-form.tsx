"use client";

import { Info, LoaderCircle, Pencil, Plus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import type { CardBrand } from "@/generated/prisma/enums";
import { button } from "@/shared/ui/button";
import { CARD_GRADIENTS } from "@/shared/ui/card-colors";
import { Dialog, DialogActions } from "@/shared/ui/dialog";
import { describedBy, Field, FIELD, FormError, MoneyInput } from "@/shared/ui/field";
import { decimal } from "@/shared/ui/format";

import type { CARD_COLORS } from "../../application/cards";
import { createCard, updateCard } from "../actions";
import { INSTITUTIONS } from "../institutions";
import { CardVisual } from "./card-visual";

type CardColor = (typeof CARD_COLORS)[number];

export interface EditableCard {
  id: string;
  updatedAt: string;
  nickname: string;
  issuer: string | null;
  brand: CardBrand;
  last4: string | null;
  color: string;
  closingDay: number;
  dueDay: number;
  limitCents: number | null;
}

const BRANDS: Record<CardBrand, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  ELO: "Elo",
  AMEX: "American Express",
  HIPERCARD: "Hipercard",
  OTHER: "Outra ou não sei",
};

const COLOR_NAMES: Record<CardColor, string> = {
  violet: "Violeta",
  blue: "Azul",
  sky: "Azul-claro",
  emerald: "Verde",
  lime: "Lima",
  amber: "Amarelo",
  orange: "Laranja",
  red: "Vermelho",
  pink: "Rosa",
  slate: "Cinza",
  black: "Preto",
};

/**
 * Formulário de cartão (FLOW_MAP §4, RF-010 a RF-012) com pré-visualização ao vivo (DESIGN §6.7).
 * `onSaved` recebe o texto do aviso de confirmação (usado no Novo lançamento).
 */
export function CardForm({
  card,
  onDone,
  onSaved,
  cancelLabel = "Cancelar",
}: {
  card?: EditableCard;
  onDone: () => void;
  onSaved?: (message: string) => void;
  /** Texto do botão secundário (o onboarding usa "Pular"). */
  cancelLabel?: string;
}) {
  const [v, setV] = useState({
    nickname: card?.nickname ?? "",
    issuer: card?.issuer ?? "",
    brand: card?.brand ?? ("OTHER" as CardBrand),
    last4: card?.last4 ?? "",
    color: (card?.color ?? "violet") as CardColor,
    closingDay: card ? String(card.closingDay) : "",
    dueDay: card ? String(card.dueDay) : "",
    limit: card?.limitCents ? decimal(card.limitCents) : "",
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => {
    setV((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };
  const err = (key: string) => errors[key]?.[0];
  const cycleChanged = card && (v.closingDay !== String(card.closingDay) || v.dueDay !== String(card.dueDay));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fields = {
      nickname: v.nickname,
      issuer: v.issuer,
      brand: v.brand,
      color: v.color,
      closingDay: Number(v.closingDay),
      dueDay: Number(v.dueDay),
    };
    const res = card
      ? await updateCard({
          ...fields,
          id: card.id,
          expectedUpdatedAt: card.updatedAt,
          last4: v.last4 || null,
          limit: v.limit || null,
        })
      : await createCard({ ...fields, last4: v.last4 || undefined, limit: v.limit || undefined });
    setBusy(false);
    if (res.ok) {
      onSaved?.(card ? "Cartão atualizado" : `Cartão ${v.nickname.trim()} criado`);
      return onDone();
    }
    setErrors(res.error.fieldErrors ?? {});
    setMessage(res.error.code === "VALIDATION_ERROR" ? null : res.error.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="mx-auto w-full max-w-[280px]">
        <CardVisual
          nickname={v.nickname || "Novo cartão"}
          issuer={v.issuer || null}
          brand={v.brand}
          last4={/^\d{4}$/.test(v.last4) ? v.last4 : null}
          color={v.color}
          closingDay={v.closingDay || "–"}
          dueDay={v.dueDay || "–"}
        />
      </div>

      <Field id="cartao-apelido" label="Apelido" error={err("nickname")}>
        <input
          {...describedBy("cartao-apelido", err("nickname"))}
          value={v.nickname}
          onChange={set("nickname")}
          required
          maxLength={40}
          autoComplete="off"
          placeholder="Ex.: Roxinho"
          className={FIELD}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cartao-emissor" label="Instituição" error={err("issuer")} hint="Opcional">
          <input
            {...describedBy("cartao-emissor", err("issuer"), "Opcional")}
            value={v.issuer}
            onChange={set("issuer")}
            list="instituicoes"
            maxLength={60}
            autoComplete="off"
            placeholder="Ex.: Nubank"
            className={FIELD}
          />
          <datalist id="instituicoes">
            {INSTITUTIONS.map((i) => (
              <option key={i.name} value={i.name} />
            ))}
          </datalist>
        </Field>
        <Field id="cartao-bandeira" label="Bandeira" error={err("brand")}>
          <select
            {...describedBy("cartao-bandeira", err("brand"))}
            value={v.brand}
            onChange={set("brand")}
            className={FIELD}
          >
            {Object.entries(BRANDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="text-label">Cor</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(COLOR_NAMES) as CardColor[]).map((c) => {
            const g = CARD_GRADIENTS[c]!;
            return (
              <label key={c} className="cursor-pointer">
                <input
                  type="radio"
                  name="cartao-cor"
                  value={c}
                  checked={v.color === c}
                  onChange={set("color")}
                  className="peer sr-only"
                />
                <span className="sr-only">{COLOR_NAMES[c]}</span>
                <span
                  aria-hidden
                  className="block size-8 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring"
                  style={{ backgroundImage: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                />
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <Field id="cartao-fechamento" label="Fecha no dia" error={err("closingDay")}>
          <input
            {...describedBy("cartao-fechamento", err("closingDay"))}
            value={v.closingDay}
            onChange={set("closingDay")}
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            required
            placeholder="25"
            className={`${FIELD} tabular-nums`}
          />
        </Field>
        <Field id="cartao-vencimento" label="Vence no dia" error={err("dueDay")}>
          <input
            {...describedBy("cartao-vencimento", err("dueDay"))}
            value={v.dueDay}
            onChange={set("dueDay")}
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            required
            placeholder="5"
            className={`${FIELD} tabular-nums`}
          />
        </Field>
      </div>
      {cycleChanged && (
        <p className="flex gap-2 rounded-md bg-status-info p-3 text-body-sm text-status-info-fg">
          <Info aria-hidden size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          Mudar o fechamento ou o vencimento recalcula só as faturas abertas. Faturas fechadas e pagas não
          mudam.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field id="cartao-limite" label="Limite" error={err("limit")} hint="Opcional">
          <MoneyInput
            {...describedBy("cartao-limite", err("limit"), "Opcional")}
            value={v.limit}
            onChange={set("limit")}
          />
        </Field>
        <Field id="cartao-final" label="Final do cartão" error={err("last4")} hint="Opcional, 4 dígitos">
          <input
            {...describedBy("cartao-final", err("last4"), "Opcional, 4 dígitos")}
            value={v.last4}
            onChange={(e) =>
              set("last4")({ target: { value: e.target.value.replace(/\D/g, "").slice(0, 4) } })
            }
            inputMode="numeric"
            autoComplete="off"
            placeholder="1234"
            className={`${FIELD} tabular-nums`}
          />
        </Field>
      </div>
      <p className="text-body-sm text-fg-muted">
        O FinFlow nunca pede o número completo, a validade nem o código de segurança.
      </p>

      {message && <FormError>{message}</FormError>}

      <DialogActions>
        <button type="button" onClick={onDone} className={button("ghost", "md")}>
          {cancelLabel}
        </button>
        <button type="submit" disabled={busy} className={button("primary", "md")}>
          {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
          {card ? "Salvar alterações" : "Criar cartão"}
        </button>
      </DialogActions>
    </form>
  );
}

/** Botão que abre o formulário de novo cartão (lista de cartões e estado vazio do painel). */
export function NewCardButton({ className, children }: { className: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Plus aria-hidden size={18} strokeWidth={1.5} />
        {children ?? "Novo cartão"}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Novo cartão">
        <CardForm onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function EditCardButton({ card }: { card: EditableCard }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={button("tonal", "sm")}>
        <Pencil aria-hidden size={16} strokeWidth={1.5} />
        Editar
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Editar cartão">
        <CardForm card={card} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
