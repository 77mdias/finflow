import type { Charge, Invoice, Payment } from "@/generated/prisma/client";
import { day, iso, n } from "@/shared/application/dto";
import { AppError } from "@/shared/domain/errors";
import type { Db } from "@/shared/infrastructure/db";

export interface InvoiceSummaryDTO {
  id: string;
  cardId: string;
  referenceMonth: string;
  periodStart: string;
  closingDate: string;
  dueDate: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: Invoice["status"];
  datesOverridden: boolean;
  updatedAt: string;
}

export interface ChargeDTO {
  id: string;
  sourceType: Charge["sourceType"];
  sourceId: string | null;
  chargeDate: string;
  description: string;
  installment: { number: number; total: number } | null;
  amountCents: number;
  categoryId: string | null;
}

export interface PaymentDTO {
  id: string;
  amountCents: number;
  paidOn: string;
  note: string | null;
  createdAt: string;
}

export const toInvoiceSummaryDTO = (i: Invoice): InvoiceSummaryDTO => ({
  id: i.id,
  cardId: i.cardId,
  referenceMonth: i.referenceMonth,
  periodStart: day(i.periodStart),
  closingDate: day(i.closingDate),
  dueDate: day(i.dueDate),
  totalCents: n(i.totalCents),
  paidCents: n(i.paidCents),
  balanceCents: n(i.totalCents - i.paidCents),
  status: i.status,
  datesOverridden: i.datesOverridden,
  updatedAt: iso(i.updatedAt),
});

export const toChargeDTO = (c: Charge): ChargeDTO => ({
  id: c.id,
  sourceType: c.sourceType,
  sourceId: c.subscriptionId ?? c.expenseId,
  chargeDate: day(c.chargeDate),
  description: c.description,
  installment:
    c.installmentNumber && c.installmentTotal
      ? { number: c.installmentNumber, total: c.installmentTotal }
      : null,
  amountCents: n(c.amountCents),
  categoryId: c.categoryId,
});

export const toPaymentDTO = (p: Payment): PaymentDTO => ({
  id: p.id,
  amountCents: n(p.amountCents),
  paidOn: day(p.paidOn),
  note: p.note,
  createdAt: iso(p.createdAt),
});

/** Fatura com cobranças materializadas e pagamentos (Q1). */
export async function getInvoice(db: Db, userId: string, invoiceId: string) {
  const inv = await db.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: {
      charges: { orderBy: [{ chargeDate: "asc" }, { createdAt: "asc" }] },
      payments: { orderBy: { paidOn: "asc" } },
    },
  });
  if (!inv) throw AppError.notFound("Fatura");
  return {
    ...toInvoiceSummaryDTO(inv),
    charges: inv.charges.map(toChargeDTO),
    payments: inv.payments.map(toPaymentDTO),
  };
}

export async function findInvoiceByReference(db: Db, userId: string, cardId: string, referenceMonth: string) {
  return db.invoice.findFirst({ where: { userId, cardId, referenceMonth } });
}

export async function listCardInvoices(db: Db, userId: string, cardId: string, limit = 12) {
  const rows = await db.invoice.findMany({
    where: { userId, cardId },
    orderBy: { referenceMonth: "desc" },
    take: limit,
  });
  return rows.map(toInvoiceSummaryDTO);
}
