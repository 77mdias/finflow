import { describe, expect, it } from "vitest";

import { parseDateOnly } from "@/shared/domain/date-only";

import { dueReminders, type ReminderInvoice, type ReminderPreferences } from "./reminders";

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
  cardId: "card-1",
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
  cardId: "card-1",
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
    // Rota real da fatura (cartão + mês de referência), usada no app e nos e-mails.
    expect(r.map((x) => x.href)).toEqual(["/cards/card-1/invoices/2026-12", "/subscriptions/sub-1"]);
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

  it("lembrete atrasado sai até 2 dias depois, com o prazo real (RNF-21)", () => {
    const on = (today: string, extra: Partial<ReminderInvoice> = {}) =>
      dueReminders({
        today: d(today),
        prefs,
        invoices: [{ ...invoice, ...extra }],
        subscriptions: [subscription],
      }).map((x) => [x.type, x.targetDate, x.title]);
    // Vencimento em 05/12 (aviso em 02/12) e Netflix em 03/12 (aviso em 02/12).
    expect(on("2026-12-03")).toEqual([
      ["INVOICE_DUE", "2026-12-05", "Fatura do Roxinho vence em 2 dias — R$ 842,17"],
      ["SUBSCRIPTION_CHARGE", "2026-12-03", "Netflix será cobrada hoje — R$ 55,90"],
    ]);
    expect(on("2026-12-04")).toEqual([
      ["INVOICE_DUE", "2026-12-05", "Fatura do Roxinho vence amanhã — R$ 842,17"],
    ]);
    expect(on("2026-12-05")).toEqual([]);
    // Vencida: aviso em 06/12; até 08/12 ainda sai.
    expect(on("2026-12-08", { status: "OVERDUE" })).toEqual([
      ["INVOICE_OVERDUE", "2026-12-05", "Fatura do Roxinho venceu há 3 dias"],
    ]);
    expect(on("2026-12-09", { status: "OVERDUE" })).toEqual([]);
  });

  it("fim de teste atrasado: um aviso por dia, o mais recente que ainda vale", () => {
    const trial = {
      ...subscription,
      status: "TRIAL" as const,
      trialEndsOn: d("2026-12-10"),
      nextChargeDate: d("2026-12-10"),
    };
    const on = (today: string) =>
      dueReminders({ today: d(today), prefs, invoices: [], subscriptions: [trial] }).map((x) => [
        x.targetDate,
        x.title,
      ]);
    expect(on("2026-12-08")).toEqual([["2026-12-07", "Seu teste de Netflix acaba em 2 dias"]]);
    expect(on("2026-12-10")).toEqual([["2026-12-09", "Seu teste de Netflix acaba hoje"]]);
    expect(on("2026-12-11")).toEqual([]);
  });

  it("cancelada não avisa cobrança após a data efetiva", () => {
    const canceled = { ...subscription, status: "CANCELED" as const, canceledOn: d("2026-12-03") };
    expect(dueReminders({ today: d("2026-12-02"), prefs, invoices: [], subscriptions: [canceled] })).toEqual(
      [],
    );
  });
});
