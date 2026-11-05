"use client";

import { Download, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { button } from "@/shared/ui/button";
import { Dialog, DialogActions } from "@/shared/ui/dialog";
import { describedBy, Field, FIELD, FormError } from "@/shared/ui/field";

import { requestAccountDeletion } from "../actions";

/** RF-006: exportação LGPD. O link baixa o JSON direto da rota (com rate limit). */
export function ExportDataLink() {
  return (
    <a href="/api/export" download className={button("tonal", "md")}>
      <Download aria-hidden size={18} strokeWidth={1.5} />
      Exportar meus dados
    </a>
  );
}

/** RF-007 / FLOW_MAP §13: confirma digitando o e-mail; encerra as sessões e leva à página inicial. */
function DeleteAccountForm({
  email,
  graceDays,
  onDone,
}: {
  email: string;
  graceDays: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await requestAccountDeletion({ confirmEmail: confirm });
    if (res.ok) {
      // O servidor já revogou as sessões; o sign-out limpa o cookie (e o cache de sessão dele) aqui.
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }).catch(() => null);
      router.replace("/");
      return router.refresh();
    }
    setBusy(false);
    setError(res.error.fieldErrors?.confirmEmail?.[0]);
    setMessage(res.error.fieldErrors?.confirmEmail ? null : res.error.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <p className="text-body text-fg-muted">
        Você sai de todos os dispositivos e os lembretes param. Os dados ficam guardados por {graceDays} dias:
        entrando de novo nesse prazo, dá para reativar. Depois disso, tudo é apagado de vez.
      </p>
      <div className="mt-4">
        <Field
          id="excluir-email"
          label={
            <>
              Digite <strong className="font-semibold">{email}</strong> para confirmar
            </>
          }
          error={error}
        >
          <input
            {...describedBy("excluir-email", error)}
            type="email"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError(undefined);
            }}
            autoComplete="off"
            spellCheck={false}
            className={FIELD}
          />
        </Field>
      </div>
      {message && (
        <div className="mt-4">
          <FormError>{message}</FormError>
        </div>
      )}
      <DialogActions>
        <button type="button" onClick={onDone} className={button("ghost", "md")}>
          Voltar
        </button>
        <button
          type="submit"
          disabled={busy || confirm.trim().toLowerCase() !== email.toLowerCase()}
          className={button("danger", "md")}
        >
          {busy && <LoaderCircle aria-hidden size={18} strokeWidth={1.5} className="animate-spin" />}
          Excluir minha conta
        </button>
      </DialogActions>
    </form>
  );
}

export function DeleteAccountButton({ email, graceDays }: { email: string; graceDays: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={button("ghost", "md")}>
        <Trash2 aria-hidden size={18} strokeWidth={1.5} className="text-status-danger-fg" />
        Excluir conta
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Excluir sua conta?">
        <DeleteAccountForm email={email} graceDays={graceDays} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
