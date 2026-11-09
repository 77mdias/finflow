import {
  addMonths,
  dateOf,
  parts,
  yearMonth,
  type DateOnly,
  type YearMonth,
} from "@/shared/domain/date-only";

/** Configuração de ciclo do cartão (1–31). */
export interface CardCycle {
  closingDay: number;
  dueDay: number;
}

export interface InvoicePeriod {
  /** RN-04: mês/ano do vencimento. */
  referenceMonth: YearMonth;
  /** Inclusivo (= fechamento anterior). */
  periodStart: DateOnly;
  /** RN-05: exclusivo no período. */
  closingDate: DateOnly;
  dueDate: DateOnly;
}

/** Fatura cujo fechamento ocorre no mês (year, month). RN-02, RN-03. */
export function invoiceClosingIn(year: number, month: number, card: CardCycle): InvoicePeriod {
  const [py, pm] = addMonths(year, month, -1);
  const [dy, dm] = card.dueDay > card.closingDay ? [year, month] : addMonths(year, month, 1);
  return {
    referenceMonth: yearMonth(dy, dm),
    periodStart: dateOf(py, pm, card.closingDay),
    closingDate: dateOf(year, month, card.closingDay),
    dueDate: dateOf(dy, dm, card.dueDay),
  };
}

/**
 * RN-05/RN-06: fatura à qual pertence uma cobrança na data `d` — a de primeiro fechamento
 * estritamente maior que `d`. `offset` desloca n ciclos (usado nas parcelas, RN-10).
 */
export function invoiceFor(d: DateOnly, card: CardCycle, offset = 0): InvoicePeriod {
  let [y, m] = parts(d);
  if (d >= dateOf(y, m, card.closingDay)) [y, m] = addMonths(y, m, 1);
  [y, m] = addMonths(y, m, offset);
  return invoiceClosingIn(y, m, card);
}

/** Fatura identificada pelo mês de referência (mês do vencimento). */
export function invoiceForReference(referenceMonth: YearMonth, card: CardCycle): InvoicePeriod {
  const [y, m] = referenceMonth.split("-").map(Number) as [number, number];
  const [cy, cm] = card.dueDay > card.closingDay ? [y, m] : addMonths(y, m, -1);
  return invoiceClosingIn(cy, cm, card);
}

/**
 * Fatura com vencimento já passado. Ao lançar algo com data antiga, o que cairia numa fatura
 * dessas é anterior ao FinFlow (foi pago fora dele) e não entra em fatura nenhuma.
 */
export const isPastDue = (p: Pick<InvoicePeriod, "dueDate">, today: DateOnly): boolean => today > p.dueDate;

/** A data pertence ao período `[periodStart, closingDate)`? */
export const isWithinPeriod = (d: DateOnly, p: Pick<InvoicePeriod, "periodStart" | "closingDate">): boolean =>
  d >= p.periodStart && d < p.closingDate;

export function assertValidCycle(card: CardCycle): void {
  for (const [k, v] of Object.entries(card)) {
    if (!Number.isInteger(v) || v < 1 || v > 31) throw new RangeError(`${k} deve estar entre 1 e 31`);
  }
}
