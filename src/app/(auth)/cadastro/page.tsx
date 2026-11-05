import type { Metadata } from "next";
import Link from "next/link";

import { googleEnabled } from "@/lib/auth";

import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Criar conta — FinFlow" };

// Lê a configuração do Google em runtime (o build não tem os segredos).
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <>
      <div className="mt-8 w-full max-w-[420px] rounded-xl bg-surface p-6 shadow-hairline sm:p-8">
        <h1 className="font-display text-heading">Crie sua conta</h1>
        <p className="mt-2 text-body text-fg-muted">Grátis, sem senha e sem conectar nenhum cartão real.</p>
        <AuthForm mode="cadastro" google={googleEnabled()} />
      </div>
      <p className="mt-6 text-center text-body-sm text-fg-muted">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-primary underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
