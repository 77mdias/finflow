import type { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import type { QueryContext } from "@/shared/application/context";
import { day, dayOrNull, iso, n } from "@/shared/application/dto";
import { AppError } from "@/shared/domain/errors";

import { monthlyEquivalent, yearlyEquivalent } from "../domain/pricing";
import type { ListSubscriptionsSchema } from "./schemas";

const include = {
  card: { select: { id: true, nickname: true, color: true } },
  category: { select: { id: true, name: true, color: true, icon: true } },
} satisfies Prisma.SubscriptionInclude;

type Row = Prisma.SubscriptionGetPayload<{ include: typeof include }>;

export interface SubscriptionDTO {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  cycle: Row["cycle"];
  status: Row["status"];
  nextChargeDate: string | null;
  trialEndsOn: string | null;
  canceledOn: string | null;
  monthlyEquivalentCents: number;
  yearlyEquivalentCents: number;
  card: { id: string; nickname: string; color: string };
  category: { id: string; name: string; color: string; icon: string } | null;
  manageUrl: string | null;
  notes: string | null;
  updatedAt: string;
}

export function toSubscriptionDTO(s: Row): SubscriptionDTO {
  const charging = s.status === "ACTIVE" || s.status === "TRIAL";
  return {
    id: s.id,
    name: s.name,
    amountCents: n(s.amountCents),
    currency: s.currency,
    cycle: s.cycle,
    status: s.status,
    nextChargeDate:
      charging || (s.status === "CANCELED" && s.canceledOn && s.nextChargeDate < s.canceledOn)
        ? day(s.nextChargeDate)
        : null,
    trialEndsOn: dayOrNull(s.trialEndsOn),
    canceledOn: dayOrNull(s.canceledOn),
    monthlyEquivalentCents: n(monthlyEquivalent(s.amountCents, s.cycle)),
    yearlyEquivalentCents: n(yearlyEquivalent(s.amountCents, s.cycle)),
    card: s.card,
    category: s.category,
    manageUrl: s.manageUrl,
    notes: s.notes,
    updatedAt: iso(s.updatedAt),
  };
}

export async function listSubscriptions(
  ctx: QueryContext,
  filters: z.input<typeof ListSubscriptionsSchema> = {},
) {
  const orderBy: Prisma.SubscriptionOrderByWithRelationInput[] =
    filters.sort === "name"
      ? [{ name: "asc" }]
      : filters.sort === "amount"
        ? [{ amountCents: "desc" }]
        : [{ nextChargeDate: "asc" }];
  const rows = await ctx.db.subscription.findMany({
    where: {
      userId: ctx.user.id,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.cardId ? { cardId: filters.cardId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    },
    include,
    orderBy,
  });
  return rows.map(toSubscriptionDTO);
}

export async function getSubscription(ctx: QueryContext, id: string) {
  const s = await ctx.db.subscription.findFirst({
    where: { id, userId: ctx.user.id },
    include: {
      ...include,
      priceHistory: { orderBy: { effectiveFrom: "asc" } },
      charges: { orderBy: { chargeDate: "desc" }, take: 12 },
    },
  });
  if (!s) throw AppError.notFound("Assinatura");
  return {
    ...toSubscriptionDTO(s),
    priceHistory: s.priceHistory.map((p) => ({
      amountCents: n(p.amountCents),
      effectiveFrom: day(p.effectiveFrom),
    })),
    recentCharges: s.charges.map((c) => ({
      id: c.id,
      chargeDate: day(c.chargeDate),
      amountCents: n(c.amountCents),
      invoiceId: c.invoiceId,
    })),
  };
}

/** RF-051: custo mensal recorrente (ACTIVE + TRIAL). */
export async function recurringMonthlyCents(ctx: QueryContext): Promise<bigint> {
  const subs = await ctx.db.subscription.findMany({
    where: { userId: ctx.user.id, status: { in: ["ACTIVE", "TRIAL"] } },
    select: { amountCents: true, cycle: true },
  });
  return subs.reduce((sum, s) => sum + monthlyEquivalent(s.amountCents, s.cycle), 0n);
}
