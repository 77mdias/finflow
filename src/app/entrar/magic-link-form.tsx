"use client";

import { CircleAlert, LoaderCircle, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";

import { button } from "@/shared/ui/button";

type State = { status: "idle" | "sending" | "error" } | { status: "sent"; email: string };

export function MagicLinkForm() {
  const [state, setState] = useState<State>({ status: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setState({ status: "sending" });
    try {
      // Better Auth (plugin magic link). shortcut: volta para "/" até existir o dashboard.
      const res = await fetch("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, callbackURL: "/" }),
      });
      setState(res.ok ? { status: "sent", email } : { status: "error" });
    } catch {
      setState({ status: "error" });
    }
  }

  if (state.status === "sent") {
    return (
      <p role="status" className="mt-6 rounded-md bg-positive-50 p-4 text-body text-positive-700">
        Enviamos um link para <strong className="font-semibold">{state.email}</strong>. Ele vale por 15
        minutos; confira também a caixa de spam.
      </p>
    );
  }

  const sending = state.status === "sending";
  return (
    <form onSubmit={onSubmit} className="mt-6">
      <label htmlFor="email" className="text-label">
        E-mail
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="voce@exemplo.com"
        aria-describedby={state.status === "error" ? "email-erro" : undefined}
        className="mt-1.5 h-12 w-full rounded-full bg-surface-subtle px-5 text-body text-fg transition-colors duration-150 outline-none placeholder:text-fg-subtle hover:bg-surface-muted focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
      />
      {state.status === "error" && (
        <p id="email-erro" role="alert" className="mt-2 flex gap-1.5 text-body-sm text-danger-700">
          <CircleAlert aria-hidden size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          Não foi possível enviar o link agora. Confira o e-mail e tente de novo em alguns minutos.
        </p>
      )}
      <button type="submit" disabled={sending} className={`${button("primary", "lg")} mt-5 w-full`}>
        {sending ? (
          <LoaderCircle aria-hidden size={20} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <Mail aria-hidden size={20} strokeWidth={1.5} />
        )}
        {sending ? "Enviando…" : "Enviar link de acesso"}
      </button>
    </form>
  );
}
