import { Bell, CalendarDays, CreditCard, House, Repeat, Settings, ShoppingBag } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { currentUser, pendingDeletionUser } from "@/lib/session";
import { todayOf } from "@/shared/application/context";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";
import { Logo } from "@/shared/ui/logo";

import { listCardOptions } from "@/modules/cards";
import { listCategories } from "@/modules/categories";
import { unreadCount } from "@/modules/notifications";

import { NavLink } from "./nav-link";
import { QuickAdd } from "./quick-add";
import { SignOutButton } from "./sign-out-button";

// DESIGN §6.9: a sidebar tem todas as áreas; a bottom nav, 4 itens (Despesas fica no painel e na sidebar).
const NAV: { href: Route; label: string; Icon: typeof House; mobile: boolean }[] = [
  { href: "/dashboard", label: "Início", Icon: House, mobile: true },
  { href: "/cards", label: "Cartões", Icon: CreditCard, mobile: true },
  { href: "/subscriptions", label: "Assinaturas", Icon: Repeat, mobile: true },
  { href: "/expenses", label: "Despesas", Icon: ShoppingBag, mobile: false },
  { href: "/calendar", label: "Calendário", Icon: CalendarDays, mobile: true },
];
const MOBILE_NAV = NAV.filter((n) => n.mobile);

/**
 * Área autenticada (DESIGN §6.9): sidebar de 248 px a partir de `lg`; no celular, barra no topo e
 * bottom nav de 64 px + safe-area.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect((await pendingDeletionUser()) ? "/reativar" : "/entrar");
  if (!user.onboardingCompletedAt) redirect("/onboarding");
  // Opções do Novo lançamento, disponível em todas as telas.
  const ctx = { db: prisma(), user, clock: systemClock };
  const [cards, categories, unread] = await Promise.all([
    listCardOptions(ctx),
    listCategories(ctx.db, user.id),
    unreadCount(ctx),
  ]);
  const quickAdd = {
    cards,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    today: todayOf(ctx),
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* sticky cria uma camada própria: o z-30 mantém o aviso do Novo lançamento acima do conteúdo. */}
      <aside className="hidden border-r border-border bg-bg px-4 py-6 lg:sticky lg:top-0 lg:z-30 lg:flex lg:h-dvh lg:flex-col">
        <Link href="/dashboard" aria-label="FinFlow, início" className="self-start rounded-md px-2">
          <Logo />
        </Link>
        <div className="mt-8">
          <QuickAdd variant="sidebar" {...quickAdd} />
        </div>
        <nav aria-label="Principal" className="mt-6 flex flex-col gap-1">
          {NAV.map(({ href, label, Icon }) => (
            <NavLink key={href} href={href} icon={<Icon aria-hidden size={20} strokeWidth={1.5} />}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
          <NavLink href="/notifications" icon={<Bell aria-hidden size={20} strokeWidth={1.5} />}>
            Notificações
            <UnreadBadge count={unread} />
          </NavLink>
          <NavLink href="/settings" icon={<Settings aria-hidden size={20} strokeWidth={1.5} />}>
            Configurações
          </NavLink>
          <p className="mt-3 truncate px-3 text-body-sm text-fg-muted" title={user.email}>
            {user.email}
          </p>
          <SignOutButton className="mt-1 w-full justify-start" />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-border px-4 lg:hidden">
          <Link href="/dashboard" aria-label="FinFlow, início" className="rounded-md">
            <Logo />
          </Link>
          <div className="-mr-2 flex items-center">
            <Link
              href="/notifications"
              aria-label={unread > 0 ? `Notificações, ${unread} não lidas` : "Notificações"}
              className="relative grid size-11 place-items-center rounded-full text-fg-muted hover:bg-surface-subtle hover:text-fg"
            >
              <Bell aria-hidden size={22} strokeWidth={1.5} />
              {unread > 0 && (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-caption leading-none font-semibold text-primary-fg tabular-nums"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link
              href="/settings"
              aria-label="Configurações"
              className="grid size-11 place-items-center rounded-full text-fg-muted hover:bg-surface-subtle hover:text-fg"
            >
              <Settings aria-hidden size={22} strokeWidth={1.5} />
            </Link>
          </div>
        </header>
        <main className="w-full px-4 pt-8 pb-40 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div
          className="mx-auto grid h-16 max-w-md"
          style={{ gridTemplateColumns: `repeat(${MOBILE_NAV.length}, 1fr)` }}
        >
          {MOBILE_NAV.map(({ href, label, Icon }) => (
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
      <div className="lg:hidden">
        <QuickAdd variant="fab" {...quickAdd} />
      </div>
    </div>
  );
}

/** Contador de não lidas ao lado de "Notificações" (some quando zera). */
function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-caption font-semibold text-primary-fg tabular-nums">
      <span className="sr-only">, </span>
      {count > 99 ? "99+" : count}
      <span className="sr-only"> não lidas</span>
    </span>
  );
}
