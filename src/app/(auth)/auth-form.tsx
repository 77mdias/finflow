"use client";

import { CircleAlert, LoaderCircle, Mail } from "lucide-react";
import { useState, type ComponentType, type FormEvent } from "react";

import type { OAuthProvider } from "@/lib/auth";
import { button } from "@/shared/ui/button";

type State =
  | { status: "idle" | "sending" }
  | { status: "social"; provider: OAuthProvider }
  | { status: "error"; message: string }
  | { status: "sent"; email: string };

const PROVIDERS: Record<OAuthProvider, { name: string; Mark: ComponentType }> = {
  google: { name: "Google", Mark: GoogleMark },
  discord: { name: "Discord", Mark: DiscordMark },
};

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
export function AuthForm({ mode, providers }: { mode: "entrar" | "cadastro"; providers: OAuthProvider[] }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const signup = mode === "cadastro";

  async function onSocial(provider: OAuthProvider) {
    setState({ status: "social", provider });
    try {
      const res = await post("/sign-in/social", { provider });
      const { url } = (await res.json()) as { url?: string };
      if (res.ok && url) return window.location.assign(url);
    } catch {
      // cai na mensagem abaixo
    }
    setState({
      status: "error",
      message: `Não foi possível abrir o login do ${PROVIDERS[provider].name}. Tente de novo ou use seu e-mail.`,
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

  const busy = state.status === "sending" || state.status === "social";
  const error = state.status === "error" ? state.message : null;
  return (
    <div className="mt-6">
      {providers.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {providers.map((provider) => {
              const { name, Mark } = PROVIDERS[provider];
              return (
                <button
                  key={provider}
                  type="button"
                  onClick={() => onSocial(provider)}
                  disabled={busy}
                  className={`${button("tonal", "lg")} w-full`}
                >
                  {state.status === "social" && state.provider === provider ? (
                    <LoaderCircle aria-hidden size={20} strokeWidth={1.5} className="animate-spin" />
                  ) : (
                    <Mark />
                  )}
                  Continuar com {name}
                </button>
              );
            })}
          </div>
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

/** Logo do Discord na cor oficial (Blurple), como pedem as diretrizes de marca. */
function DiscordMark() {
  return (
    <svg aria-hidden width={20} height={20} viewBox="0 0 24 24">
      <path
        fill="#5865F2"
        d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.1.246.199.373.293a.077.077 0 0 1-.007.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
      />
    </svg>
  );
}
