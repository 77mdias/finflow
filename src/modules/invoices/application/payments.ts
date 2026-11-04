import { type UseCaseContext, todayOf } from "@/shared/application/context";
import { addDays, fromDbDate, parseYearMonth, toDbDate, type DateOnly } from "@/shared/domain/date-only";
import { AppError } from "@/shared/domain/errors";
import { formatMoney } from "@/shared/domain/money";
import type { Tx } from "@/shared/infrastructure/db";

import { invoiceForReference } from "../domain/billing-cycle";
import { isLocked } from "../domain/invoice-state";
import { postCharge, refreshInvoiceStatus, removeCharges } from "./charges";

/** Bloqueia a linha da fatura (serializa pagamentos concorrentes — DATABASE Q6). */
async function lockInvoice(tx: Tx, userId: string, invoiceId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM invoices WHERE id = ${invoiceId}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw AppError.notFound("Fatura");
  return tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
}

/** RF-044: registra pagamento (parcial ou total) sem exceder o saldo. */
export async function registerPayment(
  ctx: UseCaseContext,
  input: { invoiceId: string; amountCents: bigint; paidOn: DateOnly; note?: string },
) {
  const inv = await lockInvoice(ctx.tx, ctx.user.id, input.invoiceId);
  const balance = inv.totalCents - inv.paidCents;
  if (input.amountCents > balance) {
    throw new AppError(
      "PAYMENT_EXCEEDS_BALANCE",
      balance > 0n
        ? `O valor excede o saldo de ${formatMoney(balance)}.`
        : "Esta fatura não tem saldo em aberto.",
    );
  }
  if (input.paidOn > addDays(todayOf(ctx), 1))
    throw AppError.validation("A data do pagamento não pode estar no futuro.");
  const payment = await ctx.tx.payment.create({
    data: {
      userId: ctx.user.id,
      invoiceId: inv.id,
      amountCents: input.amountCents,
      paidOn: toDbDate(input.paidOn),
      note: input.note ?? null,
    },
  });
  await ctx.tx.invoice.update({
    where: { id: inv.id },
    data: { paidCents: { increment: input.amountCents } },
  });
  const status = await refreshInvoiceStatus(ctx.tx, inv.id, todayOf(ctx));
  return { paymentId: payment.id, invoiceId: inv.id, status };
}

/** RF-045: desfaz um pagamento. */
export async function deletePayment(ctx: UseCaseContext, input: { paymentId: string }) {
  const payment = await ctx.tx.payment.findFirst({ where: { id: input.paymentId, userId: ctx.user.id } });
  if (!payment) throw AppError.notFound("Pagamento");
  await lockInvoice(ctx.tx, ctx.user.id, payment.invoiceId);
  await ctx.tx.payment.delete({ where: { id: payment.id } });
  await ctx.tx.invoice.update({
    where: { id: payment.invoiceId },
    data: { paidCents: { decrement: payment.amountCents } },
  });
  const status = await refreshInvoiceStatus(ctx.tx, payment.invoiceId, todayOf(ctx));
  return { invoiceId: payment.invoiceId, status };
}

/** RF-034: ajuste manual (crédito negativo ou débito positivo) em uma fatura. */
export async function createAdjustment(
  ctx: UseCaseContext,
  input: { invoiceId: string; amountCents: bigint; description: string; categoryId?: string },
) {
  const inv = await lockInvoice(ctx.tx, ctx.user.id, input.invoiceId);
  const card = await ctx.tx.card.findUniqueOrThrow({ where: { id: inv.cardId } });
  if (input.categoryId) await assertCategory(ctx, input.categoryId);
  const period = {
    referenceMonth: parseYearMonth(inv.referenceMonth),
    periodStart: fromDbDate(inv.periodStart),
    closingDate: fromDbDate(inv.closingDate),
    dueDate: fromDbDate(inv.dueDate),
  };
  const today = todayOf(ctx);
  // Data do ajuste: hoje, limitada ao período da fatura.
  const chargeDate =
    today < period.periodStart
      ? period.periodStart
      : today >= period.closingDate
        ? addDays(period.closingDate, -1)
        : today;
  await postCharge(
    ctx.tx,
    {
      card,
      chargeDate,
      period,
      sourceType: "ADJUSTMENT",
      description: input.description,
      amountCents: input.amountCents,
      categoryId: input.categoryId ?? null,
    },
    today,
  );
  return { invoiceId: inv.id };
}

export async function deleteAdjustment(ctx: UseCaseContext, input: { chargeId: string }) {
  const charge = await ctx.tx.charge.findFirst({
    where: { id: input.chargeId, userId: ctx.user.id, sourceType: "ADJUSTMENT" },
  });
  if (!charge) throw AppError.notFound("Ajuste");
  await lockInvoice(ctx.tx, ctx.user.id, charge.invoiceId);
  await removeCharges(ctx.tx, { userId: ctx.user.id, id: charge.id }, todayOf(ctx));
  return { invoiceId: charge.invoiceId };
}

/** RF-047: ajuste manual das datas de uma fatura aberta (ex.: feriado). */
export async function overrideInvoiceDates(
  ctx: UseCaseContext,
  input: { invoiceId: string; closingDate: DateOnly; dueDate: DateOnly },
) {
  const inv = await lockInvoice(ctx.tx, ctx.user.id, input.invoiceId);
  if (isLocked(inv.status))
    throw new AppError("INVOICE_LOCKED", "Só é possível ajustar datas de faturas abertas.");
  if (!(fromDbDate(inv.periodStart) < input.closingDate && input.closingDate <= input.dueDate)) {
    throw AppError.validation("O fechamento deve ser após o início do período e até o vencimento.", {
      closingDate: ["Data inválida"],
    });
  }
  await ctx.tx.invoice.update({
    where: { id: inv.id },
    data: {
      closingDate: toDbDate(input.closingDate),
      dueDate: toDbDate(input.dueDate),
      datesOverridden: true,
    },
  });
  await refreshInvoiceStatus(ctx.tx, inv.id, todayOf(ctx));
  return { invoiceId: inv.id };
}

export async function resetInvoiceDates(ctx: UseCaseContext, input: { invoiceId: string }) {
  const inv = await lockInvoice(ctx.tx, ctx.user.id, input.invoiceId);
  if (isLocked(inv.status))
    throw new AppError("INVOICE_LOCKED", "Só é possível ajustar datas de faturas abertas.");
  const card = await ctx.tx.card.findUniqueOrThrow({ where: { id: inv.cardId } });
  const p = invoiceForReference(parseYearMonth(inv.referenceMonth), card);
  await ctx.tx.invoice.update({
    where: { id: inv.id },
    data: { closingDate: toDbDate(p.closingDate), dueDate: toDbDate(p.dueDate), datesOverridden: false },
  });
  await refreshInvoiceStatus(ctx.tx, inv.id, todayOf(ctx));
  return { invoiceId: inv.id };
}

async function assertCategory(ctx: UseCaseContext, categoryId: string) {
  const c = await ctx.tx.category.findFirst({
    where: { id: categoryId, userId: ctx.user.id },
    select: { id: true },
  });
  if (!c) throw AppError.notFound("Categoria");
}
