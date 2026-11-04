import { describe, expect, it } from "vitest";

import { parseDateOnly } from "@/shared/domain/date-only";

import { nextStatus } from "./invoice-state";

const inv = (totalCents: bigint, paidCents: bigint) => ({
  closingDate: parseDateOnly("2026-11-25"),
  dueDate: parseDateOnly("2026-12-05"),
  totalCents,
  paidCents,
});
const on = (s: string) => parseDateOnly(s);

describe("nextStatus (RN-15, RN-18)", () => {
  it.each([
    ["aberta antes do fechamento", inv(10_000n, 0n), "2026-11-24", "OPEN"],
    ["parcialmente paga antes do fechamento continua aberta", inv(10_000n, 5_000n), "2026-11-24", "OPEN"],
    ["paga antecipadamente", inv(10_000n, 10_000n), "2026-11-20", "PAID"],
    ["aberta sem cobranças não é 'paga'", inv(0n, 0n), "2026-11-20", "OPEN"],
    ["fecha no dia do fechamento", inv(10_000n, 0n), "2026-11-25", "CLOSED"],
    ["fatura zerada é paga ao fechar", inv(0n, 0n), "2026-11-25", "PAID"],
    ["pagamento parcial após fechamento", inv(10_000n, 4_000n), "2026-11-30", "PARTIALLY_PAID"],
    ["quitada após fechamento", inv(10_000n, 10_000n), "2026-11-30", "PAID"],
    ["no dia do vencimento ainda não está vencida", inv(10_000n, 0n), "2026-12-05", "CLOSED"],
    ["vencida no dia seguinte", inv(10_000n, 0n), "2026-12-06", "OVERDUE"],
    ["vencida com pagamento parcial", inv(10_000n, 1_000n), "2026-12-06", "OVERDUE"],
    ["estorno deixa saldo negativo → paga", inv(-500n, 0n), "2026-11-30", "PAID"],
  ])("%s", (_name, invoice, today, expected) => {
    expect(nextStatus(invoice, on(today))).toBe(expected);
  });
});
