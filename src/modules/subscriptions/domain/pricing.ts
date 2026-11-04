import type { DateOnly } from "@/shared/domain/date-only";
import { divRound } from "@/shared/domain/money";

import type { BillingCycle } from "./recurrence";

export interface PricePoint {
  amountCents: bigint;
  effectiveFrom: DateOnly;
}

/** Valor vigente na data `d`: maior `effectiveFrom ≤ d` (RF-024). */
export function priceAt(history: readonly PricePoint[], d: DateOnly, fallback: bigint): bigint {
  let best: PricePoint | undefined;
  for (const p of history) {
    if (p.effectiveFrom <= d && (!best || p.effectiveFrom > best.effectiveFrom)) best = p;
  }
  return best?.amountCents ?? fallback;
}

/** Ocorrências por ano de cada periodicidade. */
const PER_YEAR: Record<BillingCycle, bigint> = {
  WEEKLY: 52n,
  MONTHLY: 12n,
  QUARTERLY: 4n,
  SEMIANNUAL: 2n,
  YEARLY: 1n,
};

/** RN-12: custo anual equivalente (exato, em centavos). */
export const yearlyEquivalent = (amountCents: bigint, cycle: BillingCycle): bigint =>
  amountCents * PER_YEAR[cycle];

/** RN-12: custo mensal equivalente, arredondado para o centavo. */
export const monthlyEquivalent = (amountCents: bigint, cycle: BillingCycle): bigint =>
  divRound(yearlyEquivalent(amountCents, cycle), 12n);
