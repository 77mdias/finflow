import { fromDbDate, toDbDate, type DateOnly } from "@/shared/domain/date-only";
import type { Tx } from "@/shared/infrastructure/db";
import { logger } from "@/shared/infrastructure/logger";

import { invoiceFor } from "../domain/billing-cycle";
import { nextStatus } from "../domain/invoice-state";
import { getOrCreateInvoice } from "./charges";

export interface BatchUser {
  id: string;
  today: DateOnly;
}

/** Job diário: fecha faturas e marca vencidas no fuso de cada usuário (RN-15). */
export async function updateInvoiceStatuses(tx: Tx, users: readonly BatchUser[]) {
  const stats = { invoicesClosed: 0, invoicesOverdue: 0, invoicesPaid: 0 };
  if (users.length === 0) return stats;
  const todayById = new Map(users.map((u) => [u.id, u.today]));
  const maxToday = users.reduce((m, u) => (u.today > m ? u.today : m), users[0]!.today);
  const candidates = await tx.invoice.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      OR: [
        { status: "OPEN", closingDate: { lte: toDbDate(maxToday) } },
        { status: { in: ["CLOSED", "PARTIALLY_PAID"] }, dueDate: { lt: toDbDate(maxToday) } },
      ],
    },
  });
  for (const inv of candidates) {
    const today = todayById.get(inv.userId)!;
    const status = nextStatus(
      {
        closingDate: fromDbDate(inv.closingDate),
        dueDate: fromDbDate(inv.dueDate),
        totalCents: inv.totalCents,
        paidCents: inv.paidCents,
      },
      today,
    );
    if (status === inv.status) continue;
    await tx.invoice.update({
      where: { id: inv.id },
      data: {
        status,
        closedAt: inv.closedAt ?? (status !== "OPEN" ? new Date() : null),
        paidAt: status === "PAID" ? (inv.paidAt ?? new Date()) : inv.paidAt,
      },
    });
    if (status === "OVERDUE") stats.invoicesOverdue++;
    else if (status === "PAID") stats.invoicesPaid++;
    else stats.invoicesClosed++;
  }
  return stats;
}

/** Garante a fatura OPEN do ciclo corrente de cada cartão ativo. */
export async function ensureCurrentInvoices(tx: Tx, users: readonly BatchUser[]) {
  const cards = await tx.card.findMany({
    where: { userId: { in: users.map((u) => u.id) }, archivedAt: null },
    select: { id: true, userId: true, closingDay: true, dueDay: true },
  });
  const todayById = new Map(users.map((u) => [u.id, u.today]));
  for (const card of cards) await getOrCreateInvoice(tx, card, invoiceFor(todayById.get(card.userId)!, card));
  return { currentInvoicesEnsured: cards.length };
}

/** RN-16: reconcilia `total_cents` × Σ cobranças; corrige e registra divergências. */
export async function reconcileInvoiceTotals(tx: Tx, userIds: readonly string[]) {
  if (userIds.length === 0) return { reconciliationMismatches: 0 };
  const rows = await tx.$queryRaw<{ id: string; total_cents: bigint; real_total: bigint }[]>`
    SELECT i.id, i.total_cents, COALESCE(SUM(c.amount_cents), 0)::bigint AS real_total
    FROM invoices i
    LEFT JOIN charges c ON c.invoice_id = i.id
    WHERE i.user_id = ANY(${userIds as string[]}::uuid[])
    GROUP BY i.id
    HAVING i.total_cents <> COALESCE(SUM(c.amount_cents), 0)`;
  for (const r of rows) {
    logger.error(
      { invoiceId: r.id, cached: String(r.total_cents), real: String(r.real_total) },
      "divergência de total de fatura",
    );
    await tx.invoice.update({ where: { id: r.id }, data: { totalCents: r.real_total } });
  }
  return { reconciliationMismatches: rows.length };
}
