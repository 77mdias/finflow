import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { currentUser } from "@/lib/session";
import { Logo } from "@/shared/ui/logo";

/** Moldura comum de /entrar e /cadastro: marca no topo e cartão centralizado. Quem já entrou vai ao painel. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await currentUser()) redirect("/dashboard");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <Link href="/" aria-label="FinFlow, página inicial" className="rounded-md">
        <Logo priority />
      </Link>
      {children}
    </main>
  );
}
