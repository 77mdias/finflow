import { type QueryContext, todayOf } from "@/shared/application/context";
import { n } from "@/shared/application/dto";
import { AppError } from "@/shared/domain/errors";
import type { Db } from "@/shared/infrastructure/db";

import {
  invoiceFor,
  listCardInvoices,
  toInvoiceSummaryDTO,
  type InvoiceSummaryDTO,
} from "@/modules/invoices";

import { toCardDTO, type CardDTO } from "./cards";

export interface CardWithCurrentInvoiceDTO extends CardDTO {
  currentInvoice: InvoiceSummaryDTO | null;
  usedLimitCents: number | null;
  availableLimitCents: number | null;
}

/** RN-14 (Q4): limite usado = cobranças em faturas não pagas − pagamentos dessas faturas. */
export async function limitUsageByCard(db: Db, userId: string): Promise<Map<string, bigint>> {
  const rows = await db.$queryRaw<{ card_id: string; used_cents: bigint }[]>`
    SELECT i.card_id,
           (COALESCE(SUM(i.total_cents), 0) - COALESCE(SUM(i.paid_cents), 0))::bigint AS used_cents
    FROM invoices i
    WHERE i.user_id = ${userId}::uuid AND i.status IN ('OPEN', 'CLOSED', 'PARTIALLY_PAID', 'OVERDUE')
    GROUP BY i.card_id`;
  return new Map(rows.map((r) => [r.card_id, r.used_cents]));
}

export async function listCards(
  ctx: QueryContext,
  opts: { includeArchived?: boolean } = {},
): Promise<CardWithCurrentInvoiceDTO[]> {
  const today = todayOf(ctx);
  const cards = await ctx.db.card.findMany({
    where: { userId: ctx.user.id, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const usage = await limitUsageByCard(ctx.db, ctx.user.id);
  const refs = cards.map((c) => ({ cardId: c.id, referenceMonth: invoiceFor(today, c).referenceMonth }));
  const invoices = refs.length
    ? await ctx.db.invoice.findMany({ where: { userId: ctx.user.id, OR: refs } })
    : [];
  return cards.map((c) => {
    const ref = invoiceFor(today, c).referenceMonth;
    const inv = invoices.find((i) => i.cardId === c.id && i.referenceMonth === ref);
    const used = usage.get(c.id) ?? 0n;
    return {
      ...toCardDTO(c),
      currentInvoice: inv ? toInvoiceSummaryDTO(inv) : null,
      usedLimitCents: c.limitCents === null ? null : n(used),
      availableLimitCents: c.limitCents === null ? null : n(c.limitCents - used),
    };
  });
}

export async function getCard(ctx: QueryContext, cardId: string) {
  const card = await ctx.db.card.findFirst({ where: { id: cardId, userId: ctx.user.id } });
  if (!card) throw AppError.notFound("Cartão");
  const all = await listCards(ctx, { includeArchived: true });
  return {
    ...all.find((c) => c.id === cardId)!,
    invoices: await listCardInvoices(ctx.db, ctx.user.id, cardId, 12),
  };
}
