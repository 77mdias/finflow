import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/shared/ui/logo";

import { MagicLinkForm } from "./magic-link-form";

export const metadata: Metadata = { title: "Entrar — FinFlow" };

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <Link href="/" aria-label="FinFlow, página inicial" className="rounded-md">
        <Logo priority />
      </Link>
      <div className="mt-8 w-full max-w-[420px] rounded-xl bg-surface p-6 shadow-hairline sm:p-8">
        <h1 className="font-display text-heading">Entrar no FinFlow</h1>
        <p className="mt-2 text-body text-fg-muted">
          Enviamos um link de acesso para o seu e-mail. Sem senha para lembrar.
        </p>
        <MagicLinkForm />
      </div>
      <p className="mt-6 max-w-[420px] text-center text-body-sm text-fg-muted">
        Se você ainda não tem conta, ela é criada no primeiro acesso.
      </p>
    </main>
  );
}
