import { describe, expect, it } from "vitest";

import { assertValidCycle } from "@/modules/invoices/domain/billing-cycle";
import { balanceOf, isLocked } from "@/modules/invoices/domain/invoice-state";

import {
  compareDates,
  isDateOnly,
  maxDate,
  minDate,
  parseDateOnly,
  yearMonth,
  yearMonthOf,
} from "./date-only";
import { AppError, HTTP_STATUS, isAppError } from "./errors";
import { sumCents } from "./money";
import { fail, ok } from "./result";

const a = parseDateOnly("2026-11-04");
const b = parseDateOnly("2026-12-05");

describe("helpers de DateOnly", () => {
  it("comparação, mínimo, máximo e mês", () => {
    expect(isDateOnly("2026-11-04")).toBe(true);
    expect(isDateOnly("2026-11-31")).toBe(false);
    expect(compareDates(a, b)).toBe(-1);
    expect(compareDates(b, a)).toBe(1);
    expect(compareDates(a, a)).toBe(0);
    expect(maxDate(a, b)).toBe(b);
    expect(minDate(a, b)).toBe(a);
    expect(yearMonthOf(b)).toBe("2026-12");
    expect(yearMonth(2027, 1)).toBe("2027-01");
  });
});

describe("erros e Result", () => {
  it("AppError carrega código e detalhes", () => {
    const e = AppError.validation("Revise os campos.", { name: ["Obrigatório"] });
    expect(isAppError(e)).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(e.details?.fieldErrors?.name).toEqual(["Obrigatório"]);
    expect(AppError.notFound("Cartão")).toMatchObject({
      code: "NOT_FOUND",
      message: "Cartão não encontrado(a).",
    });
    expect(HTTP_STATUS.PAYMENT_EXCEEDS_BALANCE).toBe(422);
    expect(HTTP_STATUS.UNAUTHENTICATED).toBe(401);
  });
  it("ok / fail", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(fail("CONFLICT", "x")).toEqual({ ok: false, code: "CONFLICT", message: "x" });
  });
});

describe("helpers de fatura e dinheiro", () => {
  it("saldo, bloqueio e soma", () => {
    expect(balanceOf({ totalCents: 1_000n, paidCents: 400n })).toBe(600n);
    expect(isLocked("OPEN")).toBe(false);
    expect(isLocked("CLOSED")).toBe(true);
    expect(sumCents([1n, 2n, 3n])).toBe(6n);
  });
  it("valida dias do ciclo", () => {
    expect(() => assertValidCycle({ closingDay: 25, dueDay: 5 })).not.toThrow();
    expect(() => assertValidCycle({ closingDay: 0, dueDay: 5 })).toThrow(RangeError);
    expect(() => assertValidCycle({ closingDay: 10, dueDay: 32 })).toThrow(RangeError);
  });
});
