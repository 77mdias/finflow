import type { DateOnly, YearMonth } from "@/shared/domain/date-only";

import { priceAt, type PricePoint } from "@/modules/subscriptions/domain/pricing";
import { occurrencesUntil, type RecurringSubscription } from "@/modules/subscriptions/domain/recurrence";

import { invoiceFor, type CardCycle, type InvoicePeriod } from "@/modules/invoices/domain/billing-cycle";

export interface ProjectableSubscription extends RecurringSubscription {
  id: string;
  name: string;
  cardId: string;
  categoryId: string | null;
  amountCents: bigint;
  priceHistory: readonly PricePoint[];
}

export interface ProjectedCharge {
  subscriptionId: string;
  cardId: string;
  categoryId: string | null;
  description: string;
  chargeDate: DateOnly;
  amountCents: bigint;
  referenceMonth: YearMonth;
}

/**
 * Ocorrências futuras (ainda não materializadas) de uma assinatura, com a fatura de destino,
 * até o fechamento `untilClosingDate` (exclusivo). Base da RF-043 e da projeção (RF-055).
 */
export function projectSubscription(
  sub: ProjectableSubscription,
  card: CardCycle,
  untilExclusive: DateOnly,
): ProjectedCharge[] {
  return occurrencesUntil(sub, untilExclusive).map((d) => ({
    subscriptionId: sub.id,
    cardId: sub.cardId,
    categoryId: sub.categoryId,
    description: sub.name,
    chargeDate: d,
    amountCents: priceAt(sub.priceHistory, d, sub.amountCents),
    referenceMonth: invoiceFor(d, card).referenceMonth,
  }));
}

export interface ProjectionInput {
  today: DateOnly;
  months: number;
  cards: ReadonlyArray<{ id: string } & CardCycle>;
  subscriptions: readonly ProjectableSubscription[];
  /** Totais materializados (cobranças persistidas) por cartão e mês de referência. */
  materialized: ReadonlyArray<{ cardId: string; referenceMonth: YearMonth; totalCents: bigint }>;
}

export interface ProjectionMonth {
  referenceMonth: YearMonth;
  totalCents: bigint;
  byCard: { cardId: string; totalCents: bigint; projectedCents: bigint }[];
}

/** RF-055: soma materializado + previsto por mês de referência, para os próximos `months` ciclos. */
export function projectInvoices(input: ProjectionInput): ProjectionMonth[] {
  const key = (cardId: string, ref: string) => `${cardId}|${ref}`;
  const materialized = new Map(
    input.materialized.map((m) => [key(m.cardId, m.referenceMonth), m.totalCents]),
  );
  const periodsByCard = new Map<string, InvoicePeriod[]>();
  for (const card of input.cards) {
    periodsByCard.set(
      card.id,
      Array.from({ length: input.months }, (_, i) => invoiceFor(input.today, card, i)),
    );
  }

  const projected = new Map<string, bigint>();
  for (const sub of input.subscriptions) {
    const card = input.cards.find((c) => c.id === sub.cardId);
    const periods = card && periodsByCard.get(card.id);
    const last = periods?.at(-1);
    if (!card || !last) continue;
    for (const ch of projectSubscription(sub, card, last.closingDate)) {
      const k = key(card.id, ch.referenceMonth);
      projected.set(k, (projected.get(k) ?? 0n) + ch.amountCents);
    }
  }

  const months = new Map<YearMonth, ProjectionMonth>();
  for (const [cardId, periods] of periodsByCard) {
    for (const p of periods) {
      const m = materialized.get(key(cardId, p.referenceMonth)) ?? 0n;
      const pr = projected.get(key(cardId, p.referenceMonth)) ?? 0n;
      const month = months.get(p.referenceMonth) ?? {
        referenceMonth: p.referenceMonth,
        totalCents: 0n,
        byCard: [],
      };
      month.totalCents += m + pr;
      month.byCard.push({ cardId, totalCents: m + pr, projectedCents: pr });
      months.set(p.referenceMonth, month);
    }
  }
  return [...months.values()].sort((a, b) => (a.referenceMonth < b.referenceMonth ? -1 : 1));
}
