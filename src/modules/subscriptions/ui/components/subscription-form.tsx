"use client";

import { ChevronDown, LoaderCircle, Pencil, Plus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import type { BillingCycle, SubscriptionStatus } from "@/generated/prisma/enums";
import { button } from "@/shared/ui/button";
import { Dialog, DialogActions } from "@/shared/ui/dialog";
import { parseMoney } from "@/shared/domain/money";
import { describedBy, Field, FIELD, FormError, MoneyInput } from "@/shared/ui/field";
import { brl } from "@/shared/ui/format";

import { monthlyEquivalent } from "../../domain/pricing";
import { createSubscription, updateSubscription } from "../actions";
import { CYCLES } from "./subscription-bits";

export interface Option {
  id: string;
  name: string;
}

export interface EditableSubscription {
  id: string;
  updatedAt: string;
  name: string;
  status: SubscriptionStatus;
  cycle: BillingCycle;
  nextChargeDate: string | null;
  categoryId: string | null;
  manageUrl: string | null;
  notes: string | null;
}

/** FLOW_MAP §5: "Assinatura adicionada · +R$ 55,90/mês" (custo mensal equivalente). */
const addedMessage = (amount: string, cycle: BillingCycle) =>
  `Assinatura adicionada · +${brl(Number(monthlyEquivalent(parseMoney(amount), cycle)))}/mês`;

/** "netflix.com/cancel" → "https://netflix.com/cancel"; o schema só aceita http(s). */
const withScheme = (url: string) => (url && !/^https?:\/\//i.test(url) ? `https://${url}` : url);

/**
 * Formulário de assinatura (FLOW_MAP §5, RF-020/RF-026). Na edição, valor e cartão ficam de fora:
 * têm ações próprias, porque mudam o histórico de preço e o destino das próximas cobranças.
 */
export function SubscriptionForm({
  sub,
  cards,
  categories,
  today,
  onDone,
  onSaved,
  onCancel = onDone,
  cancelLabel = "Cancelar",
}: {
  sub?: EditableSubscription;
  cards: Option[];
  categories: Option[];
  today: string;
  onDone: () => void;
  /** Recebe o texto do aviso de confirmação (usado no Novo lançamento). */
  onSaved?: (message: string) => void;
  /** Botão secundário; no onboarding ele avança, e salvar limpa o formulário para a próxima. */
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [v, setV] = useState({
    name: sub?.name ?? "",
    amount: "",
    cycle: sub?.cycle ?? ("MONTHLY" as BillingCycle),
    trial: false,
    trialEndsOn: "",
    nextChargeDate: sub?.nextChargeDate ?? "",
    cardId: cards[0]?.id ?? "",
    categoryId: sub?.categoryId ?? "",
    manageUrl: sub?.manageUrl ?? "",
    notes: sub?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) => {
    setV((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };
  const err = (key: string) => errors[key]?.[0];
  const manageUrl = withScheme(v.manageUrl.trim());
  // Pausada não tem próxima cobrança: ela é escolhida ao retomar.
  const showNext = sub?.status !== "PAUSED";
  const nextLabel = v.trial ? "Primeira cobrança" : "Próxima cobrança";
  const nextHint = v.trial ? "Opcional. Se ficar vazia, é no fim do teste." : undefined;

  const nextField = showNext && (
    <Field id="assinatura-proxima" label={nextLabel} error={err("nextChargeDate")} hint={nextHint}>
      <input
        {...describedBy("assinatura-proxima", err("nextChargeDate"), nextHint)}
        type="date"
        value={v.nextChargeDate}
        min={sub ? today : undefined}
        onChange={set("nextChargeDate")}
        required={!v.trial}
        className={FIELD}
      />
    </Field>
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Na edição a data só vai ao servidor se mudou; apagada, ela seria ignorada em silêncio.
    if (sub && showNext && !v.nextChargeDate) {
      return setErrors((prev) => ({ ...prev, nextChargeDate: ["Informe a próxima cobrança"] }));
    }
    setBusy(true);
    const res = sub
      ? await updateSubscription({
          id: sub.id,
          expectedUpdatedAt: sub.updatedAt,
          name: v.name,
          cycle: v.cycle,
          categoryId: v.categoryId || null,
          manageUrl: manageUrl || null,
          notes: v.notes.trim() || null,
          // Só manda a data se mudou: a atual pode ter ficado no passado antes do job diário.
          ...(v.nextChargeDate && v.nextChargeDate !== sub.nextChargeDate
            ? { nextChargeDate: v.nextChargeDate }
            : {}),
        })
      : await createSubscription({
          name: v.name,
          amount: v.amount,
          cycle: v.cycle,
          status: v.trial ? "TRIAL" : "ACTIVE",
          trialEndsOn: v.trial ? v.trialEndsOn || undefined : undefined,
          nextChargeDate: v.nextChargeDate || undefined,
          cardId: v.cardId,
          categoryId: v.categoryId || undefined,
          manageUrl: manageUrl || undefined,
          notes: v.notes,
        });
    setBusy(false);
    if (res.ok) {
      onSaved?.(sub ? "Assinatura atualizada" : addedMessage(v.amount, v.cycle));
      return onDone();
    }
    setErrors(res.error.fieldErrors ?? {});
    setMessage(res.error.code === "VALIDATION_ERROR" ? null : res.error.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field id="assinatura-nome" label="Nome" error={err("name")}>
        <input
          {...describedBy("assinatura-nome", err("name"))}
          value={v.name}
          onChange={set("name")}
          required
          maxLength={80}
          autoComplete="off"
          placeholder="Ex.: Netflix"
          className={FIELD}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        {!sub && (
          <Field id="assinatura-valor" label="Valor" error={err("amount")}>
            <MoneyInput
              {...describedBy("assinatura-valor", err("amount"))}
              value={v.amount}
              onChange={set("amount")}
              required
            />
          </Field>
        )}
        <Field id="assinatura-ciclo" label="Cobrança" error={err("cycle")}>
          <select
            {...describedBy("assinatura-ciclo", err("cycle"))}
            value={v.cycle}
            onChange={set("cycle")}
            className={FIELD}
          >
            {Object.entries(CYCLES).map(([value, c]) => (
              <option key={value} value={value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        {sub && nextField}
      </div>

      {!sub && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body">
          <input
            type="checkbox"
            checked={v.trial}
            onChange={(e) => {
              setV((prev) => ({ ...prev, trial: e.target.checked }));
              // A regra das datas muda com o teste: erros antigos delas não valem mais.
              setErrors((prev) => ({ ...prev, nextChargeDate: undefined, trialEndsOn: undefined }));
            }}
            className="size-5 accent-[var(--primary)]"
          />
          É um teste grátis
        </label>
      )}

      {!sub && (
        <div className="grid grid-cols-2 gap-4">
          {v.trial && (
            <Field id="assinatura-teste" label="Fim do teste" error={err("trialEndsOn")}>
              <input
                {...describedBy("assinatura-teste", err("trialEndsOn"))}
                type="date"
                value={v.trialEndsOn}
                onChange={set("trialEndsOn")}
                required
                className={FIELD}
              />
            </Field>
          )}
          {nextField}
        </div>
      )}

      <div className={sub ? undefined : "grid gap-4 sm:grid-cols-2"}>
        {!sub && (
          <Field id="assinatura-cartao" label="Cartão" error={err("cardId")}>
            <select
              {...describedBy("assinatura-cartao", err("cardId"))}
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
        )}
        <Field id="assinatura-categoria" label="Categoria" error={err("categoryId")} hint="Opcional">
          <select
            {...describedBy("assinatura-categoria", err("categoryId"), "Opcional")}
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
      </div>

      <details open={!!(sub?.manageUrl || sub?.notes)} className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-label text-fg-muted hover:text-fg">
          Link de cancelamento e observações
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={1.5}
            className="transition-transform duration-150 group-open:rotate-180"
          />
        </summary>
        <div className="mt-2 flex flex-col gap-4">
          <Field
            id="assinatura-link"
            label="Onde gerenciar ou cancelar"
            error={err("manageUrl")}
            hint="Opcional. O endereço da página do serviço."
          >
            <input
              {...describedBy(
                "assinatura-link",
                err("manageUrl"),
                "Opcional. O endereço da página do serviço.",
              )}
              value={v.manageUrl}
              onChange={set("manageUrl")}
              type="url"
              inputMode="url"
              maxLength={500}
              autoComplete="off"
              placeholder="Ex.: netflix.com/cancelplan"
              className={FIELD}
            />
          </Field>
          <Field id="assinatura-notas" label="Observações" error={err("notes")} hint="Opcional">
            <textarea
              {...describedBy("assinatura-notas", err("notes"), "Opcional")}
              value={v.notes}
              onChange={set("notes")}
              maxLength={2000}
              rows={3}
              className={`${FIELD} min-h-24 resize-y py-3`}
            />
          </Field>
        </div>
      </details>

      {message && <FormError>{message}</FormError>}

      <DialogActions>
        <button type="button" onClick={onCancel} className={button("ghost", "md")}>
          {cancelLabel}
        </button>
        <button type="submit" disabled={busy} className={button("primary", "md")}>
          {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
          {sub ? "Salvar alterações" : "Adicionar assinatura"}
        </button>
      </DialogActions>
    </form>
  );
}

type Lists = { cards: Option[]; categories: Option[]; today: string };

/** Abre o formulário de nova assinatura (lista e estado vazio). Precisa de pelo menos um cartão ativo. */
export function NewSubscriptionButton({
  className,
  children,
  ...lists
}: Lists & { className: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Plus aria-hidden size={18} strokeWidth={1.5} />
        {children ?? "Nova assinatura"}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Nova assinatura">
        <SubscriptionForm {...lists} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function EditSubscriptionButton({
  sub,
  categories,
  today,
}: {
  sub: EditableSubscription;
  categories: Option[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={button("tonal", "sm")}>
        <Pencil aria-hidden size={16} strokeWidth={1.5} />
        Editar
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Editar assinatura">
        <SubscriptionForm
          sub={sub}
          cards={[]}
          categories={categories}
          today={today}
          onDone={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
