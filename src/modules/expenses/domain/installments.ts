import { addMonthsTo, type DateOnly } from "@/shared/domain/date-only";

import { invoiceFor, type CardCycle, type InvoicePeriod } from "@/modules/invoices/domain/billing-cycle";

export const MAX_INSTALLMENTS = 48;

export interface Installment {
  number: number;
  total: number;
  /** Data exibida da parcela (compra + k−1 meses). */
  date: DateOnly;
  /** Fatura de destino: a da 1ª parcela deslocada k−1 ciclos. */
  invoice: InvoicePeriod;
  amountCents: bigint;
}

/**
 * RN-10: divide `totalCents` em `n` parcelas; o resto vai para a 1ª.
 * A fatura de cada parcela é escolhida por deslocamento de ciclo — nunca pela data
 * recalculada, que pode pular uma fatura quando o dia é ajustado pela RN-02.
 */
export function splitInstallments(
  totalCents: bigint,
  n: number,
  purchaseDate: DateOnly,
  card: CardCycle,
): Installment[] {
  if (!Number.isInteger(n) || n < 1 || n > MAX_INSTALLMENTS) {
    throw new RangeError(`Número de parcelas deve estar entre 1 e ${MAX_INSTALLMENTS}`);
  }
  if (totalCents <= 0n) throw new RangeError("Valor total deve ser positivo");
  const base = totalCents / BigInt(n);
  const rest = totalCents - base * BigInt(n);
  return Array.from({ length: n }, (_, i) => ({
    number: i + 1,
    total: n,
    date: addMonthsTo(purchaseDate, i),
    invoice: invoiceFor(purchaseDate, card, i),
    amountCents: i === 0 ? base + rest : base,
  }));
}

export const installmentDescription = (description: string, k: number, n: number): string =>
  n === 1 ? description : `${description} (${k}/${n})`;
