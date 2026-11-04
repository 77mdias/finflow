import type { Plan } from "@/generated/prisma/enums";
import { AppError } from "@/shared/domain/errors";

/** RN-21: limites por plano (aplicados somente com LIMITS_ENFORCED=true). */
export const PLAN_LIMITS: Record<Plan, { cards: number; subscriptions: number }> = {
  FREE: { cards: 3, subscriptions: 15 },
  PRO: { cards: Number.POSITIVE_INFINITY, subscriptions: Number.POSITIVE_INFINITY },
};

const LABEL = { cards: "cartões", subscriptions: "assinaturas" } as const;

export function assertWithinPlan(
  plan: Plan,
  resource: keyof (typeof PLAN_LIMITS)["FREE"],
  currentCount: number,
  enforced: boolean,
): void {
  const limit = PLAN_LIMITS[plan][resource];
  if (enforced && currentCount >= limit) {
    throw new AppError(
      "PLAN_LIMIT_REACHED",
      `O plano ${plan === "FREE" ? "Free" : plan} permite até ${limit} ${LABEL[resource]}.`,
    );
  }
}
