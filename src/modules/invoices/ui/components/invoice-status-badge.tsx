import { Calendar, Check, CircleAlert, Clock, Contrast, FileText, type LucideIcon } from "lucide-react";

export type InvoiceBadgeStatus = "OPEN" | "CLOSED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "FUTURE";

/** DESIGN §6.6: ícone + texto sempre, cores pelos tokens de status. */
const STATUS: Record<InvoiceBadgeStatus, { label: string; Icon: LucideIcon; className: string }> = {
  OPEN: { label: "Aberta", Icon: Clock, className: "bg-status-info text-status-info-fg" },
  CLOSED: { label: "Fechada", Icon: FileText, className: "bg-status-warning text-status-warning-fg" },
  PARTIALLY_PAID: { label: "Parcial", Icon: Contrast, className: "bg-status-warning text-status-warning-fg" },
  PAID: { label: "Paga", Icon: Check, className: "bg-status-positive text-status-positive-fg" },
  OVERDUE: { label: "Vencida", Icon: CircleAlert, className: "bg-status-danger text-status-danger-fg" },
  FUTURE: {
    label: "Futura",
    Icon: Calendar,
    className: "text-fg-muted shadow-[inset_0_0_0_1px_var(--border-strong)]",
  },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceBadgeStatus }) {
  const { label, Icon, className } = STATUS[status];
  return (
    <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-caption ${className}`}>
      <Icon aria-hidden size={14} strokeWidth={1.5} />
      {label}
    </span>
  );
}
