import { z } from "zod";

import type { Card } from "@/generated/prisma/client";
import { CardBrand } from "@/generated/prisma/enums";
import { assertNotStale } from "@/shared/application/concurrency";
import { type UseCaseContext, todayOf } from "@/shared/application/context";
import { iso, nOrNull } from "@/shared/application/dto";
import { assertWithinPlan } from "@/shared/application/plan-limits";
import { DayOfMonth, ExpectedUpdatedAt, Id, MoneyInput, OptionalText } from "@/shared/application/schemas";
import { env } from "@/shared/config/env";
import { fromDbDate, parseYearMonth, toDbDate } from "@/shared/domain/date-only";
import { AppError } from "@/shared/domain/errors";
import type { Tx } from "@/shared/infrastructure/db";

import {
  getOrCreateInvoice,
  invoiceFor,
  invoiceForReference,
  recomputeInvoiceTotal,
  refreshInvoiceStatus,
  type CardCycle,
  type InvoicePeriod,
} from "@/modules/invoices";
import { cancelSubscriptionsOfCard, moveSubscriptionsToCard } from "@/modules/subscriptions";

export const CARD_COLORS = [
  "violet",
  "blue",
  "sky",
  "emerald",
  "lime",
  "amber",
  "orange",
  "red",
  "pink",
  "slate",
  "black",
] as const;

const CardFields = z.object({
  nickname: z.string().trim().min(1, "Informe um apelido").max(40),
  issuer: OptionalText(60),
  brand: z.enum(Object.values(CardBrand) as [CardBrand, ...CardBrand[]]).default("OTHER"),
  last4: z
    .string()
    .regex(/^\d{4}$/, "Use exatamente 4 dígitos (fictícios)")
    .optional(),
  color: z.enum(CARD_COLORS).default("violet"),
  limit: MoneyInput.optional(),
  closingDay: DayOfMonth,
  dueDay: DayOfMonth,
  isDefault: z.boolean().optional(),
});

export const CreateCardSchema = CardFields;
export const UpdateCardSchema = CardFields.partial().extend({
  id: Id,
  expectedUpdatedAt: ExpectedUpdatedAt,
  /** "" remove a instituição (no cadastro, vazio só significa "não informada") */
  issuer: z
    .string()
    .trim()
    .max(60, "Máximo de 60 caracteres")
    .transform((v) => v || null)
    .optional(),
  /** null remove o limite / os 4 dígitos */
  limit: MoneyInput.nullable().optional(),
  last4: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
});
export const ArchiveCardSchema = z.object({
  id: Id,
  reassignTo: Id.optional(),
  cancelSubscriptions: z.boolean().optional(),
});
export const CardIdSchema = z.object({ id: Id });

export interface CardDTO {
  id: string;
  nickname: string;
  issuer: string | null;
  brand: CardBrand;
  last4: string | null;
  color: string;
  limitCents: number | null;
  closingDay: number;
  dueDay: number;
  isDefault: boolean;
  archivedAt: string | null;
  updatedAt: string;
}

export const toCardDTO = (c: Card): CardDTO => ({
  id: c.id,
  nickname: c.nickname,
  issuer: c.issuer,
  brand: c.brand,
  last4: c.last4,
  color: c.color,
  limitCents: nOrNull(c.limitCents),
  closingDay: c.closingDay,
  dueDay: c.dueDay,
  isDefault: c.isDefault,
  archivedAt: c.archivedAt ? iso(c.archivedAt) : null,
  updatedAt: iso(c.updatedAt),
});

async function findOwnCard(tx: Tx, userId: string, id: string): Promise<Card> {
  const card = await tx.card.findFirst({ where: { id, userId } });
  if (!card) throw AppError.notFound("Cartão");
  return card;
}

async function setAsDefault(tx: Tx, userId: string, cardId: string) {
  await tx.card.updateMany({
    where: { userId, isDefault: true, NOT: { id: cardId } },
    data: { isDefault: false },
  });
  await tx.card.update({ where: { id: cardId }, data: { isDefault: true } });
}

/** RF-010: cria cartão e a fatura aberta do ciclo corrente. */
export async function createCard(
  ctx: UseCaseContext,
  input: z.infer<typeof CreateCardSchema>,
): Promise<CardDTO> {
  const active = await ctx.tx.card.count({ where: { userId: ctx.user.id, archivedAt: null } });
  assertWithinPlan(ctx.user.plan, "cards", active, env().LIMITS_ENFORCED);
  const card = await ctx.tx.card.create({
    data: {
      userId: ctx.user.id,
      nickname: input.nickname,
      issuer: input.issuer ?? null,
      brand: input.brand,
      last4: input.last4 ?? null,
      color: input.color,
      limitCents: input.limit ?? null,
      closingDay: input.closingDay,
      dueDay: input.dueDay,
    },
  });
  if (input.isDefault || active === 0) await setAsDefault(ctx.tx, ctx.user.id, card.id);
  await getOrCreateInvoice(ctx.tx, card, invoiceFor(todayOf(ctx), card));
  return toCardDTO(await ctx.tx.card.findUniqueOrThrow({ where: { id: card.id } }));
}

/** RF-012 + RN-07: alterar fechamento/vencimento recalcula apenas faturas abertas. */
export async function updateCard(ctx: UseCaseContext, input: z.infer<typeof UpdateCardSchema>) {
  const card = await findOwnCard(ctx.tx, ctx.user.id, input.id);
  assertNotStale(card.updatedAt, input.expectedUpdatedAt);
  const { id, expectedUpdatedAt: _e, limit, isDefault, ...fields } = input;
  const updated = await ctx.tx.card.update({
    where: { id },
    data: { ...fields, ...(limit !== undefined ? { limitCents: limit } : {}) },
  });
  if (isDefault) await setAsDefault(ctx.tx, ctx.user.id, id);
  let invoicesRecalculated = 0;
  if (updated.closingDay !== card.closingDay || updated.dueDay !== card.dueDay) {
    invoicesRecalculated = await reassignOpenInvoices(ctx, updated);
  }
  return { card: toCardDTO(await ctx.tx.card.findUniqueOrThrow({ where: { id } })), invoicesRecalculated };
}

/**
 * RN-07: redistribui as cobranças das faturas OPEN (sem datas manuais) pelo novo ciclo.
 * Se o novo ciclo exigir lançar em uma fatura já fechada, a operação é recusada.
 */
async function reassignOpenInvoices(ctx: UseCaseContext, card: Card): Promise<number> {
  const today = todayOf(ctx);
  const open = await ctx.tx.invoice.findMany({
    where: { cardId: card.id, status: "OPEN", datesOverridden: false },
    include: {
      charges: { include: { expense: { select: { purchaseDate: true } } } },
      _count: { select: { payments: true } },
    },
  });
  const cycle: CardCycle = card;
  const target = new Map<string, InvoicePeriod>();
  const moves: { chargeId: string; period: InvoicePeriod }[] = [];
  for (const inv of open) {
    for (const ch of inv.charges) {
      const period =
        ch.sourceType === "INSTALLMENT" && ch.expense && ch.installmentNumber
          ? invoiceFor(fromDbDate(ch.expense.purchaseDate), cycle, ch.installmentNumber - 1)
          : invoiceFor(fromDbDate(ch.chargeDate), cycle);
      target.set(period.referenceMonth, period);
      moves.push({ chargeId: ch.id, period });
    }
  }
  // Recalcula datas das faturas abertas existentes pelo novo ciclo.
  for (const inv of open) {
    const p = invoiceForReference(parseYearMonth(inv.referenceMonth), cycle);
    await ctx.tx.invoice.update({
      where: { id: inv.id },
      data: {
        periodStart: toDbDate(p.periodStart),
        closingDate: toDbDate(p.closingDate),
        dueDate: toDbDate(p.dueDate),
      },
    });
  }
  const invoiceIdByRef = new Map<string, string>();
  for (const [ref, period] of target) {
    const existing = await ctx.tx.invoice.findUnique({
      where: { cardId_referenceMonth: { cardId: card.id, referenceMonth: ref } },
    });
    if (existing && existing.status !== "OPEN") {
      throw new AppError(
        "INVOICE_LOCKED",
        `O novo ciclo moveria cobranças para a fatura ${ref}, que já está fechada.`,
      );
    }
    invoiceIdByRef.set(ref, (existing ?? (await getOrCreateInvoice(ctx.tx, card, period))).id);
  }
  for (const m of moves) {
    await ctx.tx.charge.update({
      where: { id: m.chargeId },
      data: { invoiceId: invoiceIdByRef.get(m.period.referenceMonth)! },
    });
  }
  const touched = new Set([...open.map((i) => i.id), ...invoiceIdByRef.values()]);
  const current = invoiceFor(today, cycle).referenceMonth;
  for (const invoiceId of touched) {
    const total = await recomputeInvoiceTotal(ctx.tx, invoiceId);
    const inv = await ctx.tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { _count: { select: { payments: true } } },
    });
    if (total === 0n && inv._count.payments === 0 && inv.referenceMonth !== current) {
      await ctx.tx.invoice.delete({ where: { id: invoiceId } });
    } else {
      await refreshInvoiceStatus(ctx.tx, invoiceId, today);
    }
  }
  await getOrCreateInvoice(ctx.tx, card, invoiceFor(today, cycle));
  return touched.size;
}

export async function setDefaultCard(ctx: UseCaseContext, input: { id: string }) {
  const card = await findOwnCard(ctx.tx, ctx.user.id, input.id);
  if (card.archivedAt) throw new AppError("CARD_ARCHIVED", "Este cartão está arquivado.");
  await setAsDefault(ctx.tx, ctx.user.id, card.id);
  return toCardDTO(await ctx.tx.card.findUniqueOrThrow({ where: { id: card.id } }));
}

/** RF-013: arquivar exige mover ou cancelar as assinaturas vivas do cartão. */
export async function archiveCard(ctx: UseCaseContext, input: z.infer<typeof ArchiveCardSchema>) {
  const card = await findOwnCard(ctx.tx, ctx.user.id, input.id);
  if (card.archivedAt) return { archived: true, moved: 0, canceled: 0 };
  const live = await ctx.tx.subscription.count({
    where: { cardId: card.id, status: { in: ["ACTIVE", "TRIAL", "PAUSED"] } },
  });
  let moved = 0;
  let canceled = 0;
  if (live > 0) {
    if (input.reassignTo) {
      if (input.reassignTo === card.id) throw AppError.validation("Escolha outro cartão.");
      const dest = await findOwnCard(ctx.tx, ctx.user.id, input.reassignTo);
      if (dest.archivedAt) throw new AppError("CARD_ARCHIVED", "O cartão de destino está arquivado.");
      moved = await moveSubscriptionsToCard(ctx, card.id, dest.id);
    } else if (input.cancelSubscriptions) {
      canceled = await cancelSubscriptionsOfCard(ctx, card.id);
    } else {
      throw new AppError(
        "CARD_HAS_ACTIVE_SUBSCRIPTIONS",
        `Mova ou cancele ${live === 1 ? "a assinatura" : `as ${live} assinaturas`} deste cartão.`,
      );
    }
  }
  await ctx.tx.card.update({ where: { id: card.id }, data: { archivedAt: new Date(), isDefault: false } });
  return { archived: true, moved, canceled };
}

export async function unarchiveCard(ctx: UseCaseContext, input: { id: string }) {
  const card = await findOwnCard(ctx.tx, ctx.user.id, input.id);
  if (!card.archivedAt) return toCardDTO(card);
  const active = await ctx.tx.card.count({ where: { userId: ctx.user.id, archivedAt: null } });
  assertWithinPlan(ctx.user.plan, "cards", active, env().LIMITS_ENFORCED);
  const updated = await ctx.tx.card.update({ where: { id: card.id }, data: { archivedAt: null } });
  await getOrCreateInvoice(ctx.tx, updated, invoiceFor(todayOf(ctx), updated));
  return toCardDTO(updated);
}

/** RF-014: só exclui cartões sem histórico de cobranças. */
export async function deleteCard(ctx: UseCaseContext, input: { id: string }) {
  const card = await findOwnCard(ctx.tx, ctx.user.id, input.id);
  const [charges, payments, subscriptions, expenses] = await Promise.all([
    ctx.tx.charge.count({ where: { cardId: card.id } }),
    ctx.tx.payment.count({ where: { invoice: { cardId: card.id } } }),
    ctx.tx.subscription.count({ where: { cardId: card.id } }),
    ctx.tx.expense.count({ where: { cardId: card.id } }),
  ]);
  if (charges + payments + subscriptions + expenses > 0) {
    throw new AppError("CARD_HAS_HISTORY", "Cartões com histórico só podem ser arquivados.");
  }
  await ctx.tx.invoice.deleteMany({ where: { cardId: card.id } });
  await ctx.tx.card.delete({ where: { id: card.id } });
  return { deleted: true };
}
