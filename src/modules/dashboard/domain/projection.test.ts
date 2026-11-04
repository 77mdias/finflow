import { describe, expect, it } from "vitest";

import { parseDateOnly, parseYearMonth } from "@/shared/domain/date-only";

import { projectInvoices, projectSubscription, type ProjectableSubscription } from "./projection";

const d = (s: string) => parseDateOnly(s);
const card = { id: "card-1", closingDay: 25, dueDay: 5 };
const sub = (over: Partial<ProjectableSubscription>): ProjectableSubscription => ({
  id: "s",
  name: "S",
  cardId: "card-1",
  categoryId: null,
  amountCents: 1_000n,
  priceHistory: [],
  status: "ACTIVE",
  cycle: "MONTHLY",
  billingAnchorDay: 1,
  nextChargeDate: d("2026-11-01"),
  trialEndsOn: null,
  canceledOn: null,
  ...over,
});

describe("projeção (RF-043, RF-055)", () => {
  it("atribui cada ocorrência à fatura correta e aplica reajuste futuro", () => {
    const netflix = sub({
      id: "netflix",
      name: "Netflix",
      amountCents: 5_590n,
      billingAnchorDay: 12,
      nextChargeDate: d("2026-12-12"),
      priceHistory: [
        { amountCents: 5_590n, effectiveFrom: d("2026-01-01") },
        { amountCents: 5_990n, effectiveFrom: d("2027-02-01") },
      ],
    });
    const charges = projectSubscription(netflix, card, d("2027-03-25"));
    expect(charges.map((c) => [c.chargeDate, c.referenceMonth, c.amountCents])).toEqual([
      ["2026-12-12", "2027-01", 5_590n],
      ["2027-01-12", "2027-02", 5_590n],
      ["2027-02-12", "2027-03", 5_990n],
      ["2027-03-12", "2027-04", 5_990n],
    ]);
  });

  it("reproduz o exemplo do FLOW_MAP §14 (materializado + previsto)", () => {
    const months = projectInvoices({
      today: d("2026-11-04"),
      months: 3,
      cards: [card],
      subscriptions: [
        sub({ id: "netflix", amountCents: 5_590n, billingAnchorDay: 12, nextChargeDate: d("2026-12-12") }),
        sub({ id: "spotify", amountCents: 2_190n, billingAnchorDay: 28, nextChargeDate: d("2026-11-28") }),
      ],
      materialized: [
        // dez/26 já tem Spotify 28/10 + Netflix 12/11 + parcela 1/6 materializados
        { cardId: "card-1", referenceMonth: parseYearMonth("2026-12"), totalCents: 27_780n },
        { cardId: "card-1", referenceMonth: parseYearMonth("2027-01"), totalCents: 20_000n },
        { cardId: "card-1", referenceMonth: parseYearMonth("2027-02"), totalCents: 20_000n },
      ],
    });
    expect(months.map((m) => [m.referenceMonth, m.totalCents])).toEqual([
      ["2026-12", 27_780n],
      ["2027-01", 27_780n],
      ["2027-02", 27_780n],
    ]);
    expect(months[1]!.byCard[0]!.projectedCents).toBe(7_780n);
  });
});
