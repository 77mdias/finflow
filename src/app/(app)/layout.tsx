import { House } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { currentUser } from "@/lib/session";
import { Logo } from "@/shared/ui/logo";

import { NavLink } from "./nav-link";
import { SignOutButton } from "./sign-out-button";

/**
 * Área autenticada (DESIGN §6.9): sidebar de 248 px a partir de `lg`, barra no topo no celular.
 * shortcut: só "Início" na navegação; bottom nav (4 itens) e FAB entram junto com Cartões, Assinaturas e Calendário.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/entrar");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-border bg-bg px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <Link href="/dashboard" aria-label="FinFlow, início" className="self-start rounded-md px-2">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="mt-8 flex flex-col gap-1">
          <NavLink href="/dashboard" icon={<House aria-hidden size={20} strokeWidth={1.5} />}>
            Início
          </NavLink>
        </nav>
        <div className="mt-auto border-t border-border pt-4">
          <p className="truncate px-3 text-body-sm text-fg-muted" title={user.email}>
            {user.email}
          </p>
          <SignOutButton className="mt-2 w-full justify-start" />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-border px-4 lg:hidden">
          <Link href="/dashboard" aria-label="FinFlow, início" className="rounded-md">
            <Logo />
          </Link>
          <SignOutButton />
        </header>
        <main className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
