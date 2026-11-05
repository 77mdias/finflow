"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const STYLES = {
  // Sidebar: ativo em `--surface-subtle` + `--fg`, inativo em `--fg-muted` (DESIGN §6.9).
  side: {
    base: "flex h-10 items-center gap-3 rounded-md px-3 text-label transition-colors duration-150",
    active: "bg-surface-subtle text-fg",
    idle: "text-fg-muted hover:bg-surface-subtle hover:text-fg",
  },
  // Bottom nav: ícone sobre o rótulo, ativo em `--primary`.
  bottom: {
    base: "flex flex-col items-center justify-center gap-1 text-caption transition-colors duration-150",
    active: "text-primary",
    idle: "text-fg-muted hover:text-fg",
  },
};

/** Item de navegação, ativo também nas subpáginas (ex.: /cards/… acende "Cartões"). */
export function NavLink({
  href,
  icon,
  children,
  variant = "side",
}: {
  href: Route;
  icon: ReactNode;
  children: ReactNode;
  variant?: keyof typeof STYLES;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const s = STYLES[variant];
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${s.base} ${active ? s.active : s.idle}`}
    >
      {icon}
      {children}
    </Link>
  );
}
