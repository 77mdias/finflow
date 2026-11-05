"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Item da sidebar: ativo em `--surface-subtle` + `--fg`, inativo em `--fg-muted` (DESIGN §6.9). */
export function NavLink({ href, icon, children }: { href: Route; icon: ReactNode; children: ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-10 items-center gap-3 rounded-md px-3 text-label transition-colors duration-150 ${
        active ? "bg-surface-subtle text-fg" : "text-fg-muted hover:bg-surface-subtle hover:text-fg"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
