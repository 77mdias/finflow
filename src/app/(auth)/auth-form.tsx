"use client";

import { CircleAlert, LoaderCircle, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";

import { button } from "@/shared/ui/button";

type State =
  | { status: "idle" | "sending" | "google" }
  | { status: "error"; message: string }
  | { status: "sent"; email: string };

// shortcut: todos voltam para "/" até existirem /dashboard e /onboarding (RF-003).
const REDIRECTS = { callbackURL: "/", errorCallbackURL: "/entrar" };

const FIELD =
  "mt-1.5 h-11 w-full rounded-md bg-surface-subtle px-4 text-body text-fg transition-colors duration-150 " +
  "outline-none placeholder:text-fg-subtle hover:bg-surface-muted focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring";

async function post(path: string, body: object): Promise<Response> {
  return fetch(`/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, ...REDIRECTS }),
  });
}

/**
 * Login e cadastro são o mesmo fluxo sem senha (RF-001–003): a conta nasce no 1º acesso.
 * O cadastro só pede o nome a mais, que o Better Auth usa ao criar o usuário.
 */
export function AuthForm({ mode, google }: { mode: "entrar" | "cadastro"; google: boolean }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const signup = mode === "cadastro";

  async function onGoogle() {
    setState({ status: "google" });
    try {
      const res = await post("/sign-in/social", { provider: "google" });
      const { url } = (await res.json()) as { url?: string };
      if (res.ok && url) return window.location.assign(url);
    } catch {
      // cai na mensagem abaixo
    }
    setState({
      status: "error",
      message: "Não foi possível abrir o login do Google. Tente de novo ou use seu e-mail.",
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const name = String(data.get("name") ?? "").trim();
    setState({ status: "sending" });
    try {
      const res = await post("/sign-in/magic-link", { email, ...(name && { name }) });
      if (res.ok) return setState({ status: "sent", email });
      setState({
        status: "error",
        message:
          res.status === 429
            ? "Muitas tentativas seguidas. Espere 1 minuto e tente de novo."
            : "Não foi possível enviar o link agora. Confira o e-mail e tente de novo em alguns minutos.",
      });
    } catch {
      setState({
        status: "error",
        message: "Sem conexão com o FinFlow. Confira sua internet e tente de novo.",
      });
    }
  }

  if (state.status === "sent") {
    return (
      <div className="mt-6">
        <p role="status" className="rounded-md bg-positive-50 p-4 text-body text-positive-700">
          Enviamos um link para <strong className="font-semibold">{state.email}</strong>.{" "}
          {signup ? "Abra-o para ativar sua conta." : "Abra-o para entrar."} Ele vale por 15 minutos; confira
          também a caixa de spam.
        </p>
        <button
          type="button"
          onClick={() => setState({ status: "idle" })}
          className={`${button("ghost", "md")} mt-3 w-full`}
        >
          Usar outro e-mail
        </button>
      </div>
    );
  }

  const busy = state.status === "sending" || state.status === "google";
  const error = state.status === "error" ? state.message : null;
  return (
    <div className="mt-6">
      {google && (
        <>
          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            className={`${button("tonal", "lg")} w-full`}
          >
            {state.status === "google" ? (
              <LoaderCircle aria-hidden size={20} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <GoogleMark />
            )}
            Continuar com Google
          </button>
          <div className="my-6 flex items-center gap-3 text-body-sm text-fg-muted" aria-hidden>
            <span className="h-px flex-1 bg-border-strong" />
            ou
            <span className="h-px flex-1 bg-border-strong" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {signup && (
          <div>
            <label htmlFor="name" className="text-label">
              Nome
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={80}
              autoComplete="name"
              placeholder="Como quer ser chamado"
              className={FIELD}
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="text-label">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            placeholder="voce@exemplo.com"
            aria-describedby={error ? "auth-erro" : undefined}
            className={FIELD}
          />
        </div>
        {error && (
          <p id="auth-erro" role="alert" className="flex gap-1.5 text-body-sm text-danger-700">
            <CircleAlert aria-hidden size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={`${button("primary", "lg")} mt-1 w-full`}>
          {state.status === "sending" ? (
            <LoaderCircle aria-hidden size={20} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <Mail aria-hidden size={20} strokeWidth={1.5} />
          )}
          {state.status === "sending" ? "Enviando…" : signup ? "Criar conta" : "Enviar link de acesso"}
        </button>
      </form>

      {/* shortcut: Termos e Privacidade ainda sem página; viram links quando /termos e /privacidade existirem. */}
      <p className="mt-6 text-center text-body-sm text-fg-muted">
        Ao continuar, você aceita os Termos de uso e a Política de privacidade do FinFlow.
      </p>
    </div>
  );
}

/** "G" oficial do Google: as diretrizes do botão exigem as cores da marca. */
function GoogleMark() {
  return (
    <svg aria-hidden width={20} height={20} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.57.38-2.29V6.6H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.4l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.6l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
