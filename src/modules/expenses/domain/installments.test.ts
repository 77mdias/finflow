import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { dateOf, parseDateOnly } from "@/shared/domain/date-only";

import { invoiceFor } from "@/modules/invoices/domain/billing-cycle";

import { installmentDescription, splitAmount, splitInstallments } from "./installments";

const roxinho = { closingDay: 25, dueDay: 5 };

describe("splitInstallments (RN-10)", () => {
  it("põe o resto na 1ª parcela e distribui em faturas consecutivas", () => {
    const p = splitInstallments(10_000n, 3, parseDateOnly("2026-11-10"), roxinho);
    expect(p.map((x) => x.amountCents)).toEqual([3_334n, 3_333n, 3_333n]);
    expect(p.map((x) => x.invoice.referenceMonth)).toEqual(["2026-12", "2027-01", "2027-02"]);
  });

  it("notebook de R$ 1.200 em 6x (FLOW_MAP §14)", () => {
    const p = splitInstallments(120_000n, 6, parseDateOnly("2026-11-20"), roxinho);
    expect(p.every((x) => x.amountCents === 20_000n)).toBe(true);
    expect(p.map((x) => x.invoice.referenceMonth)).toEqual([
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
    ]);
  });

  it("não pula fatura com fechamento dia 31 e compra dia 30", () => {
    const p = splitInstallments(30_000n, 3, parseDateOnly("2027-01-30"), { closingDay: 31, dueDay: 10 });
    expect(p.map((x) => x.invoice.closingDate)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
    expect(p.map((x) => x.date)).toEqual(["2027-01-30", "2027-02-28", "2027-03-30"]);
  });

  it("rejeita entradas inválidas", () => {
    expect(() => splitInstallments(100n, 0, parseDateOnly("2026-01-01"), roxinho)).toThrow(RangeError);
    expect(() => splitInstallments(100n, 49, parseDateOnly("2026-01-01"), roxinho)).toThrow(RangeError);
    expect(() => splitInstallments(0n, 2, parseDateOnly("2026-01-01"), roxinho)).toThrow(RangeError);
  });

  it("descrição com k/N só quando parcelado", () => {
    expect(installmentDescription("Notebook", 2, 6)).toBe("Notebook (2/6)");
    expect(installmentDescription("Mercado", 1, 1)).toBe("Mercado");
  });

  it("propriedades: soma = total, uma parcela por fatura consecutiva, diferença máxima de N−1 centavos", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 100_000_000n }),
        fc.integer({ min: 1, max: 48 }),
        fc.record({
          y: fc.integer({ min: 2020, max: 2035 }),
          m: fc.integer({ min: 1, max: 12 }),
          day: fc.integer({ min: 1, max: 31 }),
        }),
        fc.record({ closingDay: fc.integer({ min: 1, max: 31 }), dueDay: fc.integer({ min: 1, max: 31 }) }),
        (total, n, { y, m, day }, card) => {
          const purchase = dateOf(y, m, day);
          const p = splitInstallments(total, n, purchase, card);
          expect(p.reduce((s, x) => s + x.amountCents, 0n)).toBe(total);
          expect(p[0]!.invoice).toEqual(invoiceFor(purchase, card));
          for (let i = 1; i < p.length; i++) {
            expect(p[i]!.invoice.periodStart).toBe(p[i - 1]!.invoice.closingDate);
          }
          const amounts = p.map((x) => x.amountCents);
          const max = amounts.reduce((a, b) => (a > b ? a : b));
          const min = amounts.reduce((a, b) => (a < b ? a : b));
          expect(max - min).toBeLessThan(BigInt(n));
        },
      ),
    );
  });
});

describe("splitAmount (RN-10)", () => {
  it("R$ 100,00 em 3x: 33,34 + 33,33 + 33,33", () => {
    expect(splitAmount(10_000n, 3)).toEqual({ base: 3_333n, first: 3_334n });
  });

  it("as parcelas somam o total e a 1ª leva menos de n centavos a mais", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 10_000_000_00n }),
        fc.integer({ min: 1, max: 48 }),
        (total, n) => {
          const { base, first } = splitAmount(total, n);
          expect(first + base * BigInt(n - 1)).toBe(total);
          expect(first - base >= 0n && first - base < BigInt(n)).toBe(true);
        },
      ),
    );
  });
});
