import { describe, expect, it } from "vitest";

import { parseDateOnly } from "@/shared/domain/date-only";

import { dueReminders, type ReminderPreferences } from "./reminders";

const d = (s: string) => parseDateOnly(s);
const prefs: ReminderPreferences = {
  invoiceDueEnabled: true,
  invoiceDueDaysBefore: 3,
  subscriptionDaysBefore: 1,
  subscriptionMinCents: 0n,
  trialReminders: true,
  overdueAlerts: true,
};
const invoice = {
  id: "inv-1",
  cardNickname: "Roxinho",
  referenceMonth: "2026-12",
  status: "CLOSED" as const,
  dueDate: d("2026-12-05"),
  balanceCents: 84_217n,
};
const subscription = {
  id: "sub-1",
  name: "Netflix",
  status: "ACTIVE" as const,
  nextChargeDate: d("2026-12-03"),
  amountCents: 5_590n,
  trialEndsOn: null,
  canceledOn: null,
  cardNickname: "Roxinho",
};

describe("dueReminders (RF-060 a RF-063)", () => {
  it("vencimento N dias antes e cobrança de assinatura no dia anterior", () => {
    const r = dueReminders({
      today: d("2026-12-02"),
      prefs,
      invoices: [invoice],
      subscriptions: [subscription],
    });
    expect(r.map((x) => [x.type, x.entityId, x.targetDate])).toEqual([
      ["INVOICE_DUE", "inv-1", "2026-12-05"],
      ["SUBSCRIPTION_CHARGE", "sub-1", "2026-12-03"],
    ]);
    expect(r[0]!.title).toBe("Fatura do Roxinho vence em 3 dias — R$ 842,17");
  });

  it("respeita preferências e saldo", () => {
    const off = { ...prefs, invoiceDueEnabled: false, subscriptionDaysBefore: null };
    expect(
      dueReminders({
        today: d("2026-12-02"),
        prefs: off,
        invoices: [invoice],
        subscriptions: [subscription],
      }),
    ).toEqual([]);
    expect(
      dueReminders({
        today: d("2026-12-02"),
        prefs,
        invoices: [{ ...invoice, balanceCents: 0n }],
        subscriptions: [],
      }),
    ).toEqual([]);
    expect(
      dueReminders({
        today: d("2026-12-02"),
        prefs: { ...prefs, subscriptionMinCents: 10_000n },
        invoices: [],
        subscriptions: [subscription],
      }),
    ).toEqual([]);
  });

  it("alerta de vencida no dia seguinte", () => {
    const r = dueReminders({
      today: d("2026-12-06"),
      prefs,
      invoices: [{ ...invoice, status: "OVERDUE" }],
      subscriptions: [],
    });
    expect(r.map((x) => x.type)).toEqual(["INVOICE_OVERDUE"]);
  });

  it("fim de teste: avisos com 3 e 1 dia de antecedência e chaves distintas", () => {
    const trial = {
      ...subscription,
      status: "TRIAL" as const,
      trialEndsOn: d("2026-12-10"),
      nextChargeDate: d("2026-12-10"),
    };
    const r3 = dueReminders({ today: d("2026-12-07"), prefs, invoices: [], subscriptions: [trial] });
    const r1 = dueReminders({ today: d("2026-12-09"), prefs, invoices: [], subscriptions: [trial] });
    expect(r3.map((x) => x.type)).toEqual(["TRIAL_ENDING"]);
    expect(r1.map((x) => x.type)).toEqual(["TRIAL_ENDING"]);
    expect(r3[0]!.targetDate).not.toBe(r1[0]!.targetDate);
  });

  it("cancelada não avisa cobrança após a data efetiva", () => {
    const canceled = { ...subscription, status: "CANCELED" as const, canceledOn: d("2026-12-03") };
    expect(dueReminders({ today: d("2026-12-02"), prefs, invoices: [], subscriptions: [canceled] })).toEqual(
      [],
    );
  });
});
