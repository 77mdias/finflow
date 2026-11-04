import { addDays, addMonths, dateOf, parts, type DateOnly } from "@/shared/domain/date-only";

export type BillingCycle = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "YEARLY";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAUSED" | "CANCELED";

const MONTHS: Record<Exclude<BillingCycle, "WEEKLY">, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  YEARLY: 12,
};

/**
 * RN-09: k-ésima ocorrência a partir de `first`, sempre relativa ao dia âncora —
 * uma assinatura do dia 31 cobra 31/01, 28/02, 31/03 (não "deriva" para 28).
 */
export function occurrence(first: DateOnly, anchorDay: number, cycle: BillingCycle, k: number): DateOnly {
  if (cycle === "WEEKLY") return addDays(first, 7 * k);
  const [y, m] = parts(first);
  const [ny, nm] = addMonths(y, m, MONTHS[cycle] * k);
  return dateOf(ny, nm, anchorDay);
}

export const nextOccurrence = (current: DateOnly, anchorDay: number, cycle: BillingCycle): DateOnly =>
  occurrence(current, anchorDay, cycle, 1);

export interface RecurringSubscription {
  status: SubscriptionStatus;
  cycle: BillingCycle;
  billingAnchorDay: number;
  /** Primeira ocorrência ainda não materializada. */
  nextChargeDate: DateOnly;
  trialEndsOn: DateOnly | null;
  canceledOn: DateOnly | null;
}

/** Uma ocorrência na data `d` gera cobrança? (RN-13) */
export function chargesOn(sub: RecurringSubscription, d: DateOnly): boolean {
  if (sub.status === "PAUSED") return false;
  if (sub.canceledOn && d >= sub.canceledOn) return false;
  if (sub.status === "TRIAL" && (!sub.trialEndsOn || d < sub.trialEndsOn)) return false;
  return true;
}

/** Ocorrências cobráveis a partir de `nextChargeDate` com data < `untilExclusive`. */
export function occurrencesUntil(
  sub: RecurringSubscription,
  untilExclusive: DateOnly,
  max = 600,
): DateOnly[] {
  const out: DateOnly[] = [];
  for (let k = 0; k < max; k++) {
    const d = occurrence(sub.nextChargeDate, sub.billingAnchorDay, sub.cycle, k);
    if (d >= untilExclusive) break;
    if (sub.canceledOn && d >= sub.canceledOn) break;
    if (chargesOn(sub, d)) out.push(d);
  }
  return out;
}
