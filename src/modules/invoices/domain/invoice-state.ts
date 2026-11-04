import type { DateOnly } from "@/shared/domain/date-only";

export type InvoiceStatus = "OPEN" | "CLOSED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

export interface InvoiceSnapshot {
  closingDate: DateOnly;
  dueDate: DateOnly;
  totalCents: bigint;
  paidCents: bigint;
}

/**
 * RN-15 / RN-18 — status derivado do estado atual da fatura (função total).
 * Recalcular sempre a partir dos fatos torna jobs, pagamentos e estornos idempotentes.
 */
export function nextStatus(inv: InvoiceSnapshot, today: DateOnly): InvoiceStatus {
  const balance = inv.totalCents - inv.paidCents;
  const closed = today >= inv.closingDate;

  if (!closed) return inv.totalCents > 0n && balance <= 0n ? "PAID" : "OPEN";
  if (balance <= 0n) return "PAID"; // inclui fatura zerada no fechamento
  if (today > inv.dueDate) return "OVERDUE";
  return inv.paidCents > 0n ? "PARTIALLY_PAID" : "CLOSED";
}

export const balanceOf = (inv: Pick<InvoiceSnapshot, "totalCents" | "paidCents">): bigint =>
  inv.totalCents - inv.paidCents;

/** Faturas que não estão mais abertas não aceitam edição de parcelas nem de datas (RF-032, RF-047). */
export const isLocked = (status: InvoiceStatus): boolean => status !== "OPEN";
