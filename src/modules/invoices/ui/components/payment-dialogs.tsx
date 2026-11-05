"use client";

import { Check, LoaderCircle, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { button } from "@/shared/ui/button";
import { Dialog, DialogActions } from "@/shared/ui/dialog";
import { describedBy, Field, FIELD, FormError, MoneyInput } from "@/shared/ui/field";
import { brl, decimal } from "@/shared/ui/format";

import { deletePayment, registerPayment } from "../actions";

/** Registrar pagamento (FLOW_MAP §10, RF-044): valor sugerido = saldo, data = hoje. */
function PaymentForm({
  invoiceId,
  balanceCents,
  today,
  onDone,
}: {
  invoiceId: string;
  balanceCents: number;
  today: string;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(decimal(balanceCents));
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const err = (key: string) => errors[key]?.[0];
  const hint = `Falta ${brl(balanceCents)}. Pode ser um valor parcial.`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await registerPayment({ invoiceId, amount, paidOn, note });
    setBusy(false);
    if (res.ok) return onDone();
    setErrors(res.error.fieldErrors ?? {});
    setMessage(res.error.code === "VALIDATION_ERROR" ? null : res.error.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field id="pagamento-valor" label="Valor pago" error={err("amount")} hint={hint}>
        <MoneyInput
          {...describedBy("pagamento-valor", err("amount"), hint)}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </Field>
      <Field id="pagamento-data" label="Data do pagamento" error={err("paidOn")}>
        <input
          {...describedBy("pagamento-data", err("paidOn"))}
          type="date"
          value={paidOn}
          max={today}
          onChange={(e) => setPaidOn(e.target.value)}
          required
          className={FIELD}
        />
      </Field>
      <Field id="pagamento-nota" label="Observação" error={err("note")} hint="Opcional">
        <input
          {...describedBy("pagamento-nota", err("note"), "Opcional")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Ex.: pago pelo app do banco"
          className={FIELD}
        />
      </Field>
      {message && <FormError>{message}</FormError>}
      <DialogActions>
        <button type="button" onClick={onDone} className={button("ghost", "md")}>
          Cancelar
        </button>
        <button type="submit" disabled={busy} className={button("primary", "md")}>
          {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
          Registrar pagamento
        </button>
      </DialogActions>
    </form>
  );
}

export function RegisterPaymentButton(props: { invoiceId: string; balanceCents: number; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${button("primary", "lg")} w-full sm:w-auto`}
      >
        <Check aria-hidden size={20} strokeWidth={1.5} />
        Registrar pagamento
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Registrar pagamento">
        <PaymentForm {...props} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

/** Excluir pagamento (RF-045), sempre com confirmação (DESIGN §6.1). */
export function DeletePaymentButton({ paymentId, label }: { paymentId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const close = () => {
    setOpen(false);
    setMessage(null);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Excluir pagamento: ${label}`}
        className="grid size-9 place-items-center rounded-full text-fg-muted hover:bg-surface-subtle hover:text-fg"
      >
        <Trash2 aria-hidden size={16} strokeWidth={1.5} />
      </button>
      <Dialog open={open} onClose={close} title="Excluir pagamento?">
        <p className="text-body text-fg-muted">{label}. O valor volta para o saldo da fatura.</p>
        {message && (
          <div className="mt-4">
            <FormError>{message}</FormError>
          </div>
        )}
        <DialogActions>
          <button type="button" onClick={close} className={button("ghost", "md")}>
            Voltar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await deletePayment({ paymentId });
              setBusy(false);
              if (res.ok) return close();
              setMessage(res.error.message);
            }}
            className={button("danger", "md")}
          >
            {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
            Excluir pagamento
          </button>
        </DialogActions>
      </Dialog>
    </>
  );
}
