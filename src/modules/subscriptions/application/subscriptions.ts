import type { z } from "zod";

import type { Card, Subscription, SubscriptionPriceHistory } from "@/generated/prisma/client";
import { assertNotStale } from "@/shared/application/concurrency";
import { type UseCaseContext, todayOf } from "@/shared/application/context";
import { assertWithinPlan } from "@/shared/application/plan-limits";
import { env } from "@/shared/config/env";
import { fromDbDate, minDate, parts, toDbDate, type DateOnly } from "@/shared/domain/date-only";
import { AppError } from "@/shared/domain/errors";
import type { Result } from "@/shared/domain/result";
import type { Tx } from "@/shared/infrastructure/db";

import { assertOwnCategory } from "@/modules/categories";
import { invoiceFor, isPastDue, postCharge } from "@/modules/invoices";

import {
  cancel,
  convertTrialIfEnded,
  isBillable,
  pause,
  resume,
  type LifecyclePatch,
  type LifecycleState,
} from "../domain/lifecycle";
import { priceAt } from "../domain/pricing";
import { nextOccurrence } from "../domain/recurrence";
import type {
  CancelSchema,
  ChangeCardSchema,
  ChangePriceSchema,
  CreateSubscriptionSchema,
  ResumeSchema,
  UpdateSubscriptionSchema,
} from "./schemas";

type SubscriptionWithHistory = Subscription & { priceHistory: SubscriptionPriceHistory[] };

const MAX_MATERIALIZE_PER_RUN = 400;

export const lifecycleOf = (s: Subscription): LifecycleState => ({
  status: s.status,
  nextChargeDate: fromDbDate(s.nextChargeDate),
  billingAnchorDay: s.billingAnchorDay,
  trialEndsOn: s.trialEndsOn ? fromDbDate(s.trialEndsOn) : null,
  canceledOn: s.canceledOn ? fromDbDate(s.canceledOn) : null,
});

const toPatchData = (p: LifecyclePatch) => ({
  ...(p.status ? { status: p.status } : {}),
  ...(p.nextChargeDate ? { nextChargeDate: toDbDate(p.nextChargeDate) } : {}),
  ...(p.billingAnchorDay ? { billingAnchorDay: p.billingAnchorDay } : {}),
  ...(p.canceledOn !== undefined ? { canceledOn: p.canceledOn ? toDbDate(p.canceledOn) : null } : {}),
  ...(p.pausedAt !== undefined ? { pausedAt: p.pausedAt } : {}),
});

const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new AppError(r.code, r.message);
  return r.value;
};

async function findOwn(tx: Tx, userId: string, id: string): Promise<SubscriptionWithHistory> {
  const s = await tx.subscription.findFirst({ where: { id, userId }, include: { priceHistory: true } });
  if (!s) throw AppError.notFound("Assinatura");
  return s;
}

async function activeCard(tx: Tx, userId: string, cardId: string): Promise<Card> {
  const card = await tx.card.findFirst({ where: { id: cardId, userId } });
  if (!card) throw AppError.notFound("Cartão");
  if (card.archivedAt) throw new AppError("CARD_ARCHIVED", "Este cartão está arquivado.");
  return card;
}

/**
 * RN-11: materializa as ocorrências com data ≤ hoje como cobranças e avança `next_charge_date`.
 * Idempotente (UNIQUE(subscription_id, charge_date)). Retorna quantas cobranças foram criadas.
 */
export async function materializeSubscription(
  tx: Tx,
  subscriptionId: string,
  today: DateOnly,
): Promise<number> {
  const s = await tx.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { priceHistory: true, card: true },
  });
  let state = lifecycleOf(s);
  const trial = convertTrialIfEnded(state, today);
  if (trial) {
    await tx.subscription.update({ where: { id: s.id }, data: toPatchData(trial) });
    state = { ...state, ...trial };
  }
  const history = s.priceHistory.map((h) => ({
    amountCents: h.amountCents,
    effectiveFrom: fromDbDate(h.effectiveFrom),
  }));
  let next = state.nextChargeDate;
  let created = 0;
  for (
    let i = 0;
    i < MAX_MATERIALIZE_PER_RUN && next <= today && isBillable({ ...state, nextChargeDate: next });
    i++
  ) {
    const r = await postCharge(
      tx,
      {
        card: s.card,
        chargeDate: next,
        sourceType: "SUBSCRIPTION",
        subscriptionId: s.id,
        description: s.name,
        amountCents: priceAt(history, next, s.amountCents),
        categoryId: s.categoryId,
      },
      today,
    );
    if (r.inserted) created++;
    next = nextOccurrence(next, state.billingAnchorDay, s.cycle);
  }
  const currentPrice = priceAt(history, today, s.amountCents);
  if (next !== state.nextChargeDate || currentPrice !== s.amountCents) {
    await tx.subscription.update({
      where: { id: s.id },
      data: { nextChargeDate: toDbDate(next), amountCents: currentPrice },
    });
  }
  return created;
}

/** RF-020 / RF-026: cria assinatura (ativa ou em teste) e materializa ocorrências passadas. */
export async function createSubscription(
  ctx: UseCaseContext,
  input: z.infer<typeof CreateSubscriptionSchema>,
) {
  const today = todayOf(ctx);
  const card = await activeCard(ctx.tx, ctx.user.id, input.cardId);
  await assertOwnCategory(ctx.tx, ctx.user.id, input.categoryId);
  const live = await ctx.tx.subscription.count({
    where: { userId: ctx.user.id, status: { not: "CANCELED" } },
  });
  assertWithinPlan(ctx.user.plan, "subscriptions", live, env().LIMITS_ENFORCED);

  const firstCharge = (
    input.status === "TRIAL" ? (input.nextChargeDate ?? input.trialEndsOn) : input.nextChargeDate
  )!;
  if (input.status === "TRIAL" && input.trialEndsOn && firstCharge < input.trialEndsOn) {
    throw AppError.validation("A primeira cobrança deve ser no fim do teste ou depois.", {
      nextChargeDate: ["Data inválida"],
    });
  }
  // Cobranças que cairiam em faturas já vencidas foram pagas antes do FinFlow: começa na primeira a pagar.
  const anchorDay = parts(firstCharge)[2];
  let nextChargeDate = firstCharge;
  while (isPastDue(invoiceFor(nextChargeDate, card), today)) {
    nextChargeDate = nextOccurrence(nextChargeDate, anchorDay, input.cycle);
  }
  const sub = await ctx.tx.subscription.create({
    data: {
      userId: ctx.user.id,
      cardId: card.id,
      categoryId: input.categoryId ?? null,
      name: input.name,
      amountCents: input.amount,
      cycle: input.cycle,
      billingAnchorDay: anchorDay,
      nextChargeDate: toDbDate(nextChargeDate),
      status: input.status,
      trialEndsOn: input.trialEndsOn ? toDbDate(input.trialEndsOn) : null,
      manageUrl: input.manageUrl ?? null,
      notes: input.notes ?? null,
      catalogSlug: input.catalogSlug ?? null,
      priceHistory: {
        create: { amountCents: input.amount, effectiveFrom: toDbDate(minDate(today, nextChargeDate)) },
      },
    },
  });
  const materialized = await materializeSubscription(ctx.tx, sub.id, today);
  return { id: sub.id, materialized };
}

export async function updateSubscription(
  ctx: UseCaseContext,
  input: z.infer<typeof UpdateSubscriptionSchema>,
) {
  const s = await findOwn(ctx.tx, ctx.user.id, input.id);
  assertNotStale(s.updatedAt, input.expectedUpdatedAt);
  if (s.status === "CANCELED")
    throw new AppError("INVALID_STATE_TRANSITION", "Assinaturas canceladas não podem ser editadas.");
  if (input.categoryId) await assertOwnCategory(ctx.tx, ctx.user.id, input.categoryId);
  const today = todayOf(ctx);
  if (input.nextChargeDate && input.nextChargeDate < today) {
    throw AppError.validation("A próxima cobrança não pode estar no passado.", {
      nextChargeDate: ["Data no passado"],
    });
  }
  // Mesma regra da criação: em teste, a cobrança só começa no fim do teste.
  if (
    input.nextChargeDate &&
    s.status === "TRIAL" &&
    s.trialEndsOn &&
    input.nextChargeDate < fromDbDate(s.trialEndsOn)
  ) {
    throw AppError.validation("A primeira cobrança deve ser no fim do teste ou depois.", {
      nextChargeDate: ["Data inválida"],
    });
  }
  await ctx.tx.subscription.update({
    where: { id: s.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.cycle !== undefined ? { cycle: input.cycle } : {}),
      ...(input.manageUrl !== undefined ? { manageUrl: input.manageUrl } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.nextChargeDate
        ? { nextChargeDate: toDbDate(input.nextChargeDate), billingAnchorDay: parts(input.nextChargeDate)[2] }
        : {}),
    },
  });
  return { id: s.id };
}

/** RF-024: novo preço a partir de uma data (histórico preservado). */
export async function changeSubscriptionPrice(ctx: UseCaseContext, input: z.infer<typeof ChangePriceSchema>) {
  const s = await findOwn(ctx.tx, ctx.user.id, input.id);
  if (s.status === "CANCELED")
    throw new AppError("INVALID_STATE_TRANSITION", "Assinaturas canceladas não podem ser editadas.");
  await ctx.tx.subscriptionPriceHistory.upsert({
    where: {
      subscriptionId_effectiveFrom: { subscriptionId: s.id, effectiveFrom: toDbDate(input.effectiveFrom) },
    },
    create: { subscriptionId: s.id, amountCents: input.amount, effectiveFrom: toDbDate(input.effectiveFrom) },
    update: { amountCents: input.amount },
  });
  if (input.effectiveFrom <= todayOf(ctx)) {
    await ctx.tx.subscription.update({ where: { id: s.id }, data: { amountCents: input.amount } });
  }
  return { id: s.id };
}

/** RF-023: cobranças futuras vão para o novo cartão; as já lançadas ficam no original. */
export async function changeSubscriptionCard(ctx: UseCaseContext, input: z.infer<typeof ChangeCardSchema>) {
  const s = await findOwn(ctx.tx, ctx.user.id, input.id);
  if (s.status === "CANCELED")
    throw new AppError("INVALID_STATE_TRANSITION", "Assinaturas canceladas não podem ser editadas.");
  const card = await activeCard(ctx.tx, ctx.user.id, input.cardId);
  await ctx.tx.subscription.update({ where: { id: s.id }, data: { cardId: card.id } });
  return { id: s.id };
}

export async function pauseSubscription(ctx: UseCaseContext, input: { id: string }) {
  const s = await findOwn(ctx.tx, ctx.user.id, input.id);
  const patch = unwrap(pause(lifecycleOf(s), ctx.clock.now()));
  await ctx.tx.subscription.update({ where: { id: s.id }, data: toPatchData(patch) });
  return { id: s.id, status: patch.status! };
}

export async function resumeSubscription(ctx: UseCaseContext, input: z.infer<typeof ResumeSchema>) {
  const s = await findOwn(ctx.tx, ctx.user.id, input.id);
  const today = todayOf(ctx);
  const patch = unwrap(resume(lifecycleOf(s), input.nextChargeDate, today));
  await ctx.tx.subscription.update({ where: { id: s.id }, data: toPatchData(patch) });
  await materializeSubscription(ctx.tx, s.id, today);
  return { id: s.id, status: patch.status! };
}

export async function cancelSubscription(ctx: UseCaseContext, input: z.infer<typeof CancelSchema>) {
  const s = await findOwn(ctx.tx, ctx.user.id, input.id);
  const patch = unwrap(cancel(lifecycleOf(s), input.effectiveOn, todayOf(ctx)));
  await ctx.tx.subscription.update({ where: { id: s.id }, data: toPatchData(patch) });
  return { id: s.id, status: patch.status!, canceledOn: patch.canceledOn! };
}

/** RN-13: "duplicar" uma assinatura (inclusive cancelada) como nova assinatura ativa. */
export async function duplicateSubscription(ctx: UseCaseContext, input: { id: string }) {
  const s = await findOwn(ctx.tx, ctx.user.id, input.id);
  const today = todayOf(ctx);
  let next = lifecycleOf(s).nextChargeDate;
  while (next < today) next = nextOccurrence(next, s.billingAnchorDay, s.cycle);
  return createSubscription(ctx, {
    name: s.name,
    amount: s.amountCents,
    cycle: s.cycle,
    nextChargeDate: next,
    cardId: s.cardId,
    categoryId: s.categoryId ?? undefined,
    status: "ACTIVE",
    manageUrl: s.manageUrl ?? undefined,
    notes: s.notes ?? undefined,
    catalogSlug: s.catalogSlug ?? undefined,
  });
}

export async function deleteSubscription(ctx: UseCaseContext, input: { id: string }) {
  const s = await findOwn(ctx.tx, ctx.user.id, input.id);
  const charges = await ctx.tx.charge.count({ where: { subscriptionId: s.id } });
  if (charges > 0)
    throw new AppError("SUBSCRIPTION_HAS_CHARGES", "Cancele a assinatura em vez de excluí-la.");
  await ctx.tx.subscription.delete({ where: { id: s.id } });
  return { deleted: true };
}

/** Usado ao arquivar um cartão (RF-013). */
export async function moveSubscriptionsToCard(
  ctx: UseCaseContext,
  fromCardId: string,
  toCardId: string,
): Promise<number> {
  const { count } = await ctx.tx.subscription.updateMany({
    where: { userId: ctx.user.id, cardId: fromCardId, status: { in: ["ACTIVE", "TRIAL", "PAUSED"] } },
    data: { cardId: toCardId },
  });
  return count;
}

export async function cancelSubscriptionsOfCard(ctx: UseCaseContext, cardId: string): Promise<number> {
  const today = toDbDate(todayOf(ctx));
  const { count } = await ctx.tx.subscription.updateMany({
    where: { userId: ctx.user.id, cardId, status: { in: ["ACTIVE", "TRIAL", "PAUSED"] } },
    data: { status: "CANCELED", canceledOn: today },
  });
  return count;
}
