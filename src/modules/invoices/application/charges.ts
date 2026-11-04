import type { ChargeSource, InvoiceStatus } from "@/generated/prisma/enums";
import type { Invoice } from "@/generated/prisma/client";
import { fromDbDate, toDbDate, type DateOnly } from "@/shared/domain/date-only";
import type { Tx } from "@/shared/infrastructure/db";

import { invoiceFor, type CardCycle, type InvoicePeriod } from "../domain/billing-cycle";
import { nextStatus } from "../domain/invoice-state";

export interface CardRef extends CardCycle {
  id: string;
  userId: string;
}

/** RF-041: get-or-create da fatura de um ciclo (idempotente via UNIQUE(card_id, reference_month)). */
export async function getOrCreateInvoice(tx: Tx, card: CardRef, period: InvoicePeriod): Promise<Invoice> {
  return tx.invoice.upsert({
    where: { cardId_referenceMonth: { cardId: card.id, referenceMonth: period.referenceMonth } },
    create: {
      userId: card.userId,
      cardId: card.id,
      referenceMonth: period.referenceMonth,
      periodStart: toDbDate(period.periodStart),
      closingDate: toDbDate(period.closingDate),
      dueDate: toDbDate(period.dueDate),
    },
    update: {},
  });
}

export interface NewCharge {
  card: CardRef;
  chargeDate: DateOnly;
  /** Fatura explícita (parcelas por deslocamento, ajustes). Padrão: invoiceFor(chargeDate). */
  period?: InvoicePeriod;
  sourceType: ChargeSource;
  subscriptionId?: string;
  expenseId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  description: string;
  amountCents: bigint;
  categoryId?: string | null;
}

/**
 * Lança uma cobrança e mantém o cache `total_cents` da fatura (RN-16).
 * Idempotente: repetir a mesma ocorrência de assinatura ou parcela não duplica (ON CONFLICT DO NOTHING).
 */
export async function postCharge(
  tx: Tx,
  input: NewCharge,
  today: DateOnly,
): Promise<{ inserted: boolean; invoiceId: string }> {
  const period = input.period ?? invoiceFor(input.chargeDate, input.card);
  const invoice = await getOrCreateInvoice(tx, input.card, period);
  const { count } = await tx.charge.createMany({
    data: [
      {
        userId: input.card.userId,
        cardId: input.card.id,
        invoiceId: invoice.id,
        sourceType: input.sourceType,
        subscriptionId: input.subscriptionId ?? null,
        expenseId: input.expenseId ?? null,
        installmentNumber: input.installmentNumber ?? null,
        installmentTotal: input.installmentTotal ?? null,
        chargeDate: toDbDate(input.chargeDate),
        description: input.description.slice(0, 160),
        amountCents: input.amountCents,
        categoryId: input.categoryId ?? null,
      },
    ],
    skipDuplicates: true,
  });
  if (count === 0) return { inserted: false, invoiceId: invoice.id };
  await tx.invoice.update({
    where: { id: invoice.id },
    data: { totalCents: { increment: input.amountCents } },
  });
  await refreshInvoiceStatus(tx, invoice.id, today);
  return { inserted: true, invoiceId: invoice.id };
}

/** Remove cobranças e atualiza totais/status das faturas afetadas. */
export async function removeCharges(
  tx: Tx,
  where: { userId: string; expenseId?: string; id?: string },
  today: DateOnly,
): Promise<string[]> {
  const charges = await tx.charge.findMany({
    where,
    select: { id: true, invoiceId: true, amountCents: true },
  });
  if (charges.length === 0) return [];
  await tx.charge.deleteMany({ where: { id: { in: charges.map((c) => c.id) } } });
  const byInvoice = new Map<string, bigint>();
  for (const c of charges) byInvoice.set(c.invoiceId, (byInvoice.get(c.invoiceId) ?? 0n) + c.amountCents);
  for (const [invoiceId, amount] of byInvoice) {
    await tx.invoice.update({ where: { id: invoiceId }, data: { totalCents: { decrement: amount } } });
    await refreshInvoiceStatus(tx, invoiceId, today);
  }
  return [...byInvoice.keys()];
}

/** Recalcula o status pela função total `nextStatus` (RN-15). */
export async function refreshInvoiceStatus(
  tx: Tx,
  invoiceId: string,
  today: DateOnly,
): Promise<InvoiceStatus> {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const status = nextStatus(
    {
      closingDate: fromDbDate(inv.closingDate),
      dueDate: fromDbDate(inv.dueDate),
      totalCents: inv.totalCents,
      paidCents: inv.paidCents,
    },
    today,
  );
  if (status !== inv.status) {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        closedAt:
          status !== "OPEN" && !inv.closedAt && today >= fromDbDate(inv.closingDate)
            ? new Date()
            : inv.closedAt,
        paidAt: status === "PAID" ? (inv.paidAt ?? new Date()) : null,
      },
    });
  }
  return status;
}

/** Recalcula `total_cents` a partir das cobranças (usado após movimentações em lote). */
export async function recomputeInvoiceTotal(tx: Tx, invoiceId: string): Promise<bigint> {
  const agg = await tx.charge.aggregate({ where: { invoiceId }, _sum: { amountCents: true } });
  const total = agg._sum.amountCents ?? 0n;
  await tx.invoice.update({ where: { id: invoiceId }, data: { totalCents: total } });
  return total;
}
