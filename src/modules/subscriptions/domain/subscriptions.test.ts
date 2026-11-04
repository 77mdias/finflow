import { describe, expect, it } from "vitest";

import { parseDateOnly, type DateOnly } from "@/shared/domain/date-only";

import { cancel, convertTrialIfEnded, isBillable, pause, resume, type LifecycleState } from "./lifecycle";
import { monthlyEquivalent, priceAt, yearlyEquivalent } from "./pricing";
import { chargesOn, occurrence, occurrencesUntil, type RecurringSubscription } from "./recurrence";

const d = (s: string) => parseDateOnly(s);

describe("occurrence (RN-09)", () => {
  it("assinatura no dia 31 não deriva", () => {
    expect([0, 1, 2, 3].map((k) => occurrence(d("2027-01-31"), 31, "MONTHLY", k))).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
    ]);
  });
  it("anual em 29/02 cai em 28/02 nos anos não bissextos", () => {
    expect(occurrence(d("2028-02-29"), 29, "YEARLY", 1)).toBe("2029-02-28");
    expect(occurrence(d("2028-02-29"), 29, "YEARLY", 4)).toBe("2032-02-29");
  });
  it("semanal atravessa a virada de ano", () => {
    expect(occurrence(d("2026-12-28"), 28, "WEEKLY", 1)).toBe("2027-01-04");
  });
  it("trimestral e semestral", () => {
    expect(occurrence(d("2026-11-30"), 30, "QUARTERLY", 1)).toBe("2027-02-28");
    expect(occurrence(d("2026-11-30"), 30, "SEMIANNUAL", 1)).toBe("2027-05-30");
  });
});

const base: RecurringSubscription = {
  status: "ACTIVE",
  cycle: "MONTHLY",
  billingAnchorDay: 12,
  nextChargeDate: d("2026-11-12"),
  trialEndsOn: null,
  canceledOn: null,
};

describe("occurrencesUntil / chargesOn", () => {
  it("lista ocorrências até o limite exclusivo", () => {
    expect(occurrencesUntil(base, d("2027-02-12"))).toEqual(["2026-11-12", "2026-12-12", "2027-01-12"]);
  });
  it("pausada não gera ocorrências", () => {
    expect(occurrencesUntil({ ...base, status: "PAUSED" }, d("2027-12-31"))).toEqual([]);
  });
  it("cancelada para antes da data efetiva", () => {
    expect(
      occurrencesUntil({ ...base, status: "CANCELED", canceledOn: d("2027-01-12") }, d("2027-12-31")),
    ).toEqual(["2026-11-12", "2026-12-12"]);
  });
  it("teste só cobra a partir do fim do teste", () => {
    const trial = {
      ...base,
      status: "TRIAL" as const,
      trialEndsOn: d("2026-12-12"),
      nextChargeDate: d("2026-12-12"),
    };
    expect(chargesOn(trial, d("2026-12-11") as DateOnly)).toBe(false);
    expect(occurrencesUntil(trial, d("2027-01-13"))).toEqual(["2026-12-12", "2027-01-12"]);
  });
});

describe("pricing (RF-024, RN-12)", () => {
  const history = [
    { amountCents: 3_990n, effectiveFrom: d("2026-01-01") },
    { amountCents: 4_490n, effectiveFrom: d("2026-12-01") },
  ];
  it("priceAt usa o maior effectiveFrom ≤ data", () => {
    expect(priceAt(history, d("2026-11-30"), 0n)).toBe(3_990n);
    expect(priceAt(history, d("2026-12-01"), 0n)).toBe(4_490n);
    expect(priceAt(history, d("2025-01-01"), 999n)).toBe(999n);
  });
  it("custos equivalentes", () => {
    expect(monthlyEquivalent(5_590n, "MONTHLY")).toBe(5_590n);
    expect(yearlyEquivalent(5_590n, "MONTHLY")).toBe(67_080n);
    expect(monthlyEquivalent(12_000n, "YEARLY")).toBe(1_000n);
    expect(monthlyEquivalent(1_000n, "WEEKLY")).toBe(4_333n); // 1000*52/12 = 4333,33
    expect(monthlyEquivalent(10_000n, "QUARTERLY")).toBe(3_333n);
    expect(yearlyEquivalent(10_000n, "SEMIANNUAL")).toBe(20_000n);
  });
});

describe("lifecycle (RN-13)", () => {
  const s: LifecycleState = {
    status: "ACTIVE",
    nextChargeDate: d("2026-11-12"),
    billingAnchorDay: 12,
    trialEndsOn: null,
    canceledOn: null,
  };
  const today = d("2026-11-04");
  const now = new Date("2026-11-04T12:00:00Z");

  it("pausa somente ativa", () => {
    expect(pause(s, now)).toMatchObject({ ok: true, value: { status: "PAUSED" } });
    expect(pause({ ...s, status: "TRIAL" }, now)).toMatchObject({
      ok: false,
      code: "INVALID_STATE_TRANSITION",
    });
  });
  it("retoma com nova data e nova âncora", () => {
    expect(resume({ ...s, status: "PAUSED" }, d("2026-11-20"), today)).toMatchObject({
      ok: true,
      value: { status: "ACTIVE", nextChargeDate: "2026-11-20", billingAnchorDay: 20 },
    });
    expect(resume(s, d("2026-11-20"), today)).toMatchObject({ ok: false, code: "INVALID_STATE_TRANSITION" });
    expect(resume({ ...s, status: "PAUSED" }, d("2026-11-01"), today)).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
  });
  it("cancela com data efetiva; pausada cancela imediatamente; cancelada é terminal", () => {
    expect(cancel(s, d("2026-12-01"), today)).toMatchObject({
      ok: true,
      value: { status: "CANCELED", canceledOn: "2026-12-01" },
    });
    expect(cancel({ ...s, status: "PAUSED" }, d("2026-12-01"), today)).toMatchObject({
      ok: true,
      value: { canceledOn: "2026-11-04" },
    });
    expect(cancel({ ...s, status: "CANCELED" }, d("2026-12-01"), today)).toMatchObject({ ok: false });
    expect(cancel(s, d("2026-11-01"), today)).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });
  it("converte teste encerrado", () => {
    expect(convertTrialIfEnded({ ...s, status: "TRIAL", trialEndsOn: d("2026-11-04") }, today)).toEqual({
      status: "ACTIVE",
    });
    expect(convertTrialIfEnded({ ...s, status: "TRIAL", trialEndsOn: d("2026-11-05") }, today)).toBeNull();
  });
  it("isBillable", () => {
    expect(isBillable(s)).toBe(true);
    expect(isBillable({ ...s, status: "PAUSED" })).toBe(false);
    expect(isBillable({ ...s, status: "CANCELED", canceledOn: d("2026-12-01") })).toBe(true);
    expect(isBillable({ ...s, status: "CANCELED", canceledOn: d("2026-11-12") })).toBe(false);
  });
});
