import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/shared/ui/logo";

/** Moldura comum de /entrar e /cadastro: marca no topo e cartão centralizado. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <Link href="/" aria-label="FinFlow, página inicial" className="rounded-md">
        <Logo priority />
      </Link>
      {children}
    </main>
  );
}
