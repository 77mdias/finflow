import { CreditCard, House } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { currentUser } from "@/lib/session";
import { Logo } from "@/shared/ui/logo";

import { NavLink } from "./nav-link";
import { SignOutButton } from "./sign-out-button";

// shortcut: Assinaturas, Calendário e o FAB "+" entram na navegação junto com as telas deles.
const NAV: { href: Route; label: string; Icon: typeof House }[] = [
  { href: "/dashboard", label: "Início", Icon: House },
  { href: "/cards", label: "Cartões", Icon: CreditCard },
];

/**
 * Área autenticada (DESIGN §6.9): sidebar de 248 px a partir de `lg`; no celular, barra no topo e
 * bottom nav de 64 px + safe-area.
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
          {NAV.map(({ href, label, Icon }) => (
            <NavLink key={href} href={href} icon={<Icon aria-hidden size={20} strokeWidth={1.5} />}>
              {label}
            </NavLink>
          ))}
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
        <main className="mx-auto w-full max-w-[1120px] px-4 pt-8 pb-28 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div
          className="mx-auto grid h-16 max-w-md"
          style={{ gridTemplateColumns: `repeat(${NAV.length}, 1fr)` }}
        >
          {NAV.map(({ href, label, Icon }) => (
            <NavLink
              key={href}
              href={href}
              variant="bottom"
              icon={<Icon aria-hidden size={22} strokeWidth={1.5} />}
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
