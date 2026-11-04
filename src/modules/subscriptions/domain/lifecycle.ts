import { parts, type DateOnly } from "@/shared/domain/date-only";
import { fail, ok, type Result } from "@/shared/domain/result";

import type { SubscriptionStatus } from "./recurrence";

export interface LifecycleState {
  status: SubscriptionStatus;
  nextChargeDate: DateOnly;
  billingAnchorDay: number;
  trialEndsOn: DateOnly | null;
  canceledOn: DateOnly | null;
}

export type LifecyclePatch = Partial<LifecycleState> & { pausedAt?: Date | null };

const invalid = (message: string) => fail<LifecyclePatch>("INVALID_STATE_TRANSITION", message);

/** RN-13: ACTIVE → PAUSED. */
export function pause(s: LifecycleState, now: Date): Result<LifecyclePatch> {
  if (s.status !== "ACTIVE") return invalid("Apenas assinaturas ativas podem ser pausadas.");
  return ok({ status: "PAUSED", pausedAt: now });
}

/** RN-13: PAUSED → ACTIVE, com nova próxima cobrança (≥ hoje). */
export function resume(s: LifecycleState, nextChargeDate: DateOnly, today: DateOnly): Result<LifecyclePatch> {
  if (s.status !== "PAUSED") return invalid("Apenas assinaturas pausadas podem ser retomadas.");
  if (nextChargeDate < today)
    return fail("VALIDATION_ERROR", "A próxima cobrança não pode estar no passado.");
  return ok({ status: "ACTIVE", nextChargeDate, billingAnchorDay: parts(nextChargeDate)[2], pausedAt: null });
}

/**
 * RN-13: TRIAL/ACTIVE/PAUSED → CANCELED (terminal). Nenhuma ocorrência em data ≥ `effectiveOn`.
 * Assinatura pausada é cancelada imediatamente (não volta a cobrar até a data efetiva).
 */
export function cancel(s: LifecycleState, effectiveOn: DateOnly, today: DateOnly): Result<LifecyclePatch> {
  if (s.status === "CANCELED") return invalid("A assinatura já está cancelada.");
  if (effectiveOn < today)
    return fail("VALIDATION_ERROR", "A data de cancelamento não pode estar no passado.");
  return ok({ status: "CANCELED", canceledOn: s.status === "PAUSED" ? today : effectiveOn });
}

/** RN-13 / RF-026: TRIAL → ACTIVE quando o teste termina. */
export function convertTrialIfEnded(s: LifecycleState, today: DateOnly): LifecyclePatch | null {
  if (s.status !== "TRIAL" || !s.trialEndsOn || s.trialEndsOn > today) return null;
  return { status: "ACTIVE" };
}

/** Assinatura ainda pode gerar cobranças (para materialização). */
export const isBillable = (s: Pick<LifecycleState, "status" | "canceledOn" | "nextChargeDate">): boolean =>
  s.status === "ACTIVE" || (s.status === "CANCELED" && !!s.canceledOn && s.nextChargeDate < s.canceledOn);
