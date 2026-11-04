import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { dateOf, parseDateOnly, type DateOnly } from "@/shared/domain/date-only";

import { invoiceFor, invoiceForReference, isWithinPeriod } from "./billing-cycle";

const d = (s: string) => parseDateOnly(s);
const roxinho = { closingDay: 25, dueDay: 5 };

describe("invoiceFor (RN-03 a RN-06)", () => {
  it.each([
    ["2026-11-10", "2026-12", "2026-10-25", "2026-11-25", "2026-12-05"],
    ["2026-11-24", "2026-12", "2026-10-25", "2026-11-25", "2026-12-05"],
    ["2026-11-25", "2027-01", "2026-11-25", "2026-12-25", "2027-01-05"],
    ["2026-11-28", "2027-01", "2026-11-25", "2026-12-25", "2027-01-05"],
    ["2026-12-28", "2027-02", "2026-12-25", "2027-01-25", "2027-02-05"],
  ])("compra em %s → fatura %s", (date, ref, start, closing, due) => {
    expect(invoiceFor(d(date), roxinho)).toEqual({
      referenceMonth: ref,
      periodStart: start,
      closingDate: closing,
      dueDate: due,
    });
  });

  it("vence no mesmo mês quando o vencimento é posterior ao fechamento", () => {
    expect(invoiceFor(d("2026-11-02"), { closingDay: 3, dueDay: 10 })).toEqual({
      referenceMonth: "2026-11",
      periodStart: "2026-10-03",
      closingDate: "2026-11-03",
      dueDate: "2026-11-10",
    });
  });

  it("ajusta fechamento dia 31 para o último dia de fevereiro (RN-02)", () => {
    const card = { closingDay: 31, dueDay: 10 };
    expect(invoiceFor(d("2027-02-15"), card)).toEqual({
      referenceMonth: "2027-03",
      periodStart: "2027-01-31",
      closingDate: "2027-02-28",
      dueDate: "2027-03-10",
    });
    expect(invoiceFor(d("2027-02-28"), card).closingDate).toBe("2027-03-31");
    expect(invoiceFor(d("2028-02-28"), card).closingDate).toBe("2028-02-29"); // bissexto
  });

  it("aplica deslocamento de ciclos", () => {
    expect(invoiceFor(d("2026-11-10"), roxinho, 2).referenceMonth).toBe("2027-02");
  });

  it("invoiceForReference é a inversa de invoiceFor", () => {
    expect(invoiceForReference(invoiceFor(d("2026-11-10"), roxinho).referenceMonth, roxinho)).toEqual(
      invoiceFor(d("2026-11-10"), roxinho),
    );
  });
});

const arbDate = fc
  .record({
    y: fc.integer({ min: 2020, max: 2035 }),
    m: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 31 }),
  })
  .map(({ y, m, day }) => dateOf(y, m, day));
const arbCard = fc.record({
  closingDay: fc.integer({ min: 1, max: 31 }),
  dueDay: fc.integer({ min: 1, max: 31 }),
});

describe("propriedades do ciclo", () => {
  it("toda cobrança cai dentro do período da sua fatura", () => {
    fc.assert(
      fc.property(arbDate, arbCard, (date, card) => {
        const p = invoiceFor(date, card);
        expect(isWithinPeriod(date, p)).toBe(true);
        expect(p.periodStart < p.closingDate).toBe(true);
        expect(p.closingDate <= p.dueDate).toBe(true);
        expect(p.dueDate.startsWith(p.referenceMonth)).toBe(true);
      }),
    );
  });

  it("períodos consecutivos são contíguos (sem buracos nem sobreposição)", () => {
    fc.assert(
      fc.property(arbDate, arbCard, fc.integer({ min: 0, max: 24 }), (date, card, k) => {
        const a = invoiceFor(date, card, k);
        const b = invoiceFor(date, card, k + 1);
        expect(b.periodStart).toBe(a.closingDate);
        expect(invoiceForReference(a.referenceMonth, card)).toEqual(a);
      }),
    );
  });

  it("o início do período (fechamento anterior) pertence à própria fatura", () => {
    fc.assert(
      fc.property(arbDate, arbCard, (date, card) => {
        const p = invoiceFor(date, card);
        expect(invoiceFor(p.periodStart as DateOnly, card)).toEqual(p);
      }),
    );
  });
});
