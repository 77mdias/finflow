import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { oauthProviders } from "@/lib/auth";

import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Entrar — FinFlow" };

/** Códigos que o Better Auth manda em `?error=` quando o link mágico ou o Google/Discord falham. */
const ERRORS = new Map([
  ["INVALID_TOKEN", "Este link de acesso expirou ou já foi usado. Peça um novo abaixo."],
  ["access_denied", "O acesso foi cancelado. Escolha outra forma de entrar quando quiser."],
  [
    "account_not_linked",
    "Já existe uma conta com este e-mail, mas o provedor não confirmou que ele é seu. Entre pelo link no e-mail.",
  ],
  [
    "email_not_found",
    "Sua conta no provedor não tem um e-mail confirmado. Confirme o e-mail lá ou entre pelo link no e-mail.",
  ],
]);

function errorMessage(error: string | string[] | undefined): string | null {
  if (!error) return null;
  return ERRORS.get(String(error)) ?? "Não foi possível concluir o acesso. Tente de novo.";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const notice = errorMessage((await searchParams).error);
  const providers = oauthProviders();
  return (
    <>
      <div className="mt-8 w-full max-w-[420px] rounded-xl bg-surface p-6 shadow-hairline sm:p-8">
        <h1 className="font-display text-heading">Entrar no FinFlow</h1>
        <p className="mt-2 text-body text-fg-muted">
          {providers.length > 0
            ? "Escolha como quer entrar. Sem senha para lembrar."
            : "Receba um link de acesso no e-mail. Sem senha para lembrar."}
        </p>
        {notice && (
          <p
            role="alert"
            className="mt-5 flex gap-2 rounded-md bg-danger-50 p-4 text-body-sm text-danger-700"
          >
            <CircleAlert aria-hidden size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            {notice}
          </p>
        )}
        <AuthForm mode="entrar" providers={providers} />
      </div>
      <p className="mt-6 text-center text-body-sm text-fg-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-primary underline-offset-4 hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </>
  );
}
