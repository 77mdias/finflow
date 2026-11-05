import { Hourglass, Pause, X, type LucideIcon } from "lucide-react";

import type { BillingCycle, SubscriptionStatus } from "@/generated/prisma/enums";
import { initials } from "@/shared/ui/format";

/** Ciclos de cobrança: nome no formulário e unidade depois do valor ("R$ 55,90/mês"). */
export const CYCLES: Record<BillingCycle, { label: string; per: string }> = {
  WEEKLY: { label: "Semanal", per: "semana" },
  MONTHLY: { label: "Mensal", per: "mês" },
  QUARTERLY: { label: "Trimestral", per: "trimestre" },
  SEMIANNUAL: { label: "Semestral", per: "semestre" },
  YEARLY: { label: "Anual", per: "ano" },
};

/**
 * Avatar do serviço (DESIGN §7): iniciais em `tonal`. shortcut: sem logos de serviços até existir o
 * catálogo licenciado (VISUAL_BRIEF §8).
 */
export function ServiceAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-tonal font-semibold text-tonal-fg ${
        size === "lg" ? "size-14 text-body" : "size-10 text-label"
      }`}
    >
      {initials(name)}
    </span>
  );
}

/** DESIGN §6.6: só aparece fora do normal (em teste, pausada, cancelada), com ícone + texto. */
const STATUS: Partial<Record<SubscriptionStatus, { label: string; Icon: LucideIcon; className: string }>> = {
  TRIAL: { label: "Em teste", Icon: Hourglass, className: "bg-status-info text-status-info-fg" },
  PAUSED: { label: "Pausada", Icon: Pause, className: "bg-surface-muted text-fg-muted" },
  CANCELED: { label: "Cancelada", Icon: X, className: "bg-surface-muted text-fg-muted" },
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const s = STATUS[status];
  if (!s) return null;
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-caption ${s.className}`}
    >
      <s.Icon aria-hidden size={14} strokeWidth={1.5} />
      {s.label}
    </span>
  );
}
