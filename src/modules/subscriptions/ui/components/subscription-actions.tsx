"use client";

import { Copy, CreditCard, LoaderCircle, Pause, Play, Tag, Trash2, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState, type FormEvent, type ReactNode } from "react";

import type { ActionResult } from "@/shared/ui/action";
import { button } from "@/shared/ui/button";
import { Dialog, DialogActions } from "@/shared/ui/dialog";
import { describedBy, Field, FIELD, FormError, MoneyInput } from "@/shared/ui/field";
import { decimal } from "@/shared/ui/format";

import {
  cancelSubscription,
  changeSubscriptionCard,
  changeSubscriptionPrice,
  deleteSubscription,
  duplicateSubscription,
  pauseSubscription,
  resumeSubscription,
} from "../actions";
import type { Option } from "./subscription-form";

/**
 * Botão que abre um diálogo de confirmação (DESIGN §6.10) e roda uma ação. O primeiro foco cai no
 * campo do diálogo ou, sem campo, em "Voltar".
 */
function ActionButton<T>({
  label,
  Icon,
  title,
  confirm,
  variant = "ghost",
  danger,
  run,
  onSuccess,
  children,
}: {
  label: string;
  Icon: LucideIcon;
  title: string;
  confirm: string;
  variant?: "tonal" | "ghost";
  danger?: boolean;
  run: () => Promise<ActionResult<T>>;
  onSuccess?: (data: T) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setMessage(null);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await run();
    setBusy(false);
    // Diálogos de um campo só: o erro do campo vira a mensagem do formulário.
    if (!res.ok) return setMessage(Object.values(res.error.fieldErrors ?? {})[0]?.[0] ?? res.error.message);
    close();
    onSuccess?.(res.data);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={button(variant, "sm")}>
        <Icon aria-hidden size={16} strokeWidth={1.5} />
        {label}
      </button>
      <Dialog open={open} onClose={close} title={title}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {children}
          {message && <FormError>{message}</FormError>}
          <DialogActions>
            <button type="button" onClick={close} className={button("ghost", "md")}>
              Voltar
            </button>
            <button type="submit" disabled={busy} className={button(danger ? "danger" : "primary", "md")}>
              {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
              {confirm}
            </button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

const Text = ({ children }: { children: ReactNode }) => <p className="text-body text-fg-muted">{children}</p>;

/** RF-024: novo valor a partir de uma data; o histórico fica guardado. */
export function ChangePriceButton({
  id,
  amountCents,
  today,
}: {
  id: string;
  amountCents: number;
  today: string;
}) {
  const [amount, setAmount] = useState(decimal(amountCents));
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  return (
    <ActionButton
      label="Mudar valor"
      Icon={Tag}
      title="Mudar valor"
      confirm="Salvar novo valor"
      run={() => changeSubscriptionPrice({ id, amount, effectiveFrom })}
    >
      <Field id="preco-valor" label="Novo valor">
        <MoneyInput
          {...describedBy("preco-valor")}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field id="preco-data" label="Vale a partir de" hint="Cobranças já lançadas não mudam.">
        <input
          {...describedBy("preco-data", undefined, "Cobranças já lançadas não mudam.")}
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          required
          className={FIELD}
        />
      </Field>
    </ActionButton>
  );
}

/** RF-023: as próximas cobranças vão para o novo cartão; as lançadas ficam no atual. */
export function ChangeCardButton({ id, cardId, cards }: { id: string; cardId: string; cards: Option[] }) {
  const others = cards.filter((c) => c.id !== cardId);
  const [to, setTo] = useState(others[0]?.id ?? "");
  return (
    <ActionButton
      label="Trocar cartão"
      Icon={CreditCard}
      title="Trocar cartão"
      confirm="Trocar cartão"
      run={() => changeSubscriptionCard({ id, cardId: to })}
    >
      <Field id="troca-cartao" label="Novo cartão" hint="As cobranças já lançadas ficam no cartão atual.">
        <select
          {...describedBy("troca-cartao", undefined, "As cobranças já lançadas ficam no cartão atual.")}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={FIELD}
        >
          {others.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
    </ActionButton>
  );
}

export function PauseButton({ id, name }: { id: string; name: string }) {
  return (
    <ActionButton
      label="Pausar"
      Icon={Pause}
      variant="tonal"
      title={`Pausar ${name}?`}
      confirm="Pausar"
      run={() => pauseSubscription({ id })}
    >
      <Text>Sem cobranças nem previsões até você retomar.</Text>
    </ActionButton>
  );
}

export function ResumeButton({ id, name, today }: { id: string; name: string; today: string }) {
  const [nextChargeDate, setNextChargeDate] = useState(today);
  return (
    <ActionButton
      label="Retomar"
      Icon={Play}
      variant="tonal"
      title={`Retomar ${name}`}
      confirm="Retomar"
      run={() => resumeSubscription({ id, nextChargeDate })}
    >
      <Field id="retomar-data" label="Próxima cobrança">
        <input
          {...describedBy("retomar-data")}
          type="date"
          value={nextChargeDate}
          min={today}
          onChange={(e) => setNextChargeDate(e.target.value)}
          required
          className={FIELD}
        />
      </Field>
    </ActionButton>
  );
}

/** RF-022: nenhuma cobrança na data efetiva nem depois. Cancelar no serviço é com o usuário. */
export function CancelSubscriptionButton({
  id,
  name,
  today,
  manageUrl,
}: {
  id: string;
  name: string;
  today: string;
  manageUrl: string | null;
}) {
  const [effectiveOn, setEffectiveOn] = useState(today);
  return (
    <ActionButton
      label="Cancelar assinatura"
      Icon={X}
      title={`Cancelar ${name}?`}
      confirm="Cancelar assinatura"
      danger
      run={() => cancelSubscription({ id, effectiveOn })}
    >
      <Field id="cancelar-data" label="Sem cobranças a partir de">
        <input
          {...describedBy("cancelar-data")}
          type="date"
          value={effectiveOn}
          min={today}
          onChange={(e) => setEffectiveOn(e.target.value)}
          required
          className={FIELD}
        />
      </Field>
      <Text>
        Isso para as cobranças no FinFlow. Para não ser cobrado de verdade, cancele também no serviço
        {manageUrl ? (
          <>
            {" "}
            (
            <a href={manageUrl} target="_blank" rel="noopener noreferrer" className="text-fg underline">
              abrir página de cancelamento
            </a>
            ).
          </>
        ) : (
          "."
        )}
      </Text>
    </ActionButton>
  );
}

/** RN-13: cria uma assinatura nova e ativa com os mesmos dados (vale também para canceladas). */
export function DuplicateButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ActionButton
      label="Duplicar"
      Icon={Copy}
      title={`Duplicar ${name}?`}
      confirm="Duplicar"
      run={() => duplicateSubscription({ id })}
      onSuccess={(data) => router.push(`/subscriptions/${data.id}` as Route)}
    >
      <Text>Cria uma assinatura ativa nova, com o mesmo valor, ciclo e cartão.</Text>
    </ActionButton>
  );
}

/** Só para assinatura sem cobranças lançadas; com cobranças, o caminho é cancelar. */
export function DeleteSubscriptionButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ActionButton
      label="Excluir"
      Icon={Trash2}
      title={`Excluir ${name}?`}
      confirm="Excluir assinatura"
      danger
      run={() => deleteSubscription({ id })}
      onSuccess={() => router.push("/subscriptions")}
    >
      <Text>Ela sai da lista e das previsões. Não dá para desfazer.</Text>
    </ActionButton>
  );
}
