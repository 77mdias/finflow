import { describe, expect, it } from "vitest";

import { parseDateOnly, parseYearMonth } from "@/shared/domain/date-only";
import { transaction } from "@/shared/infrastructure/db";

import { createCard } from "@/modules/cards";
import { getCalendar } from "@/modules/dashboard";
import { createExpense, listExpenses } from "@/modules/expenses";
import { createSubscription, materializeDueSubscriptions } from "@/modules/subscriptions";

import { at, db, makeUser, queryCtx, run, resetDatabaseBeforeEach } from "../support/db";

resetDatabaseBeforeEach();

const d = parseDateOnly;

/** Roxinho (fecha dia 25, vence dia 5) com Spotify mensal desde 28/10 e duas despesas. */
async function scenario() {
  const ana = await makeUser();
  const card = await run(ana, at("2026-10-20"), (ctx) =>
    createCard(ctx, { nickname: "Roxinho", brand: "MASTERCARD", color: "violet", closingDay: 25, dueDay: 5 }),
  );
  await run(ana, at("2026-10-20"), (ctx) =>
    createSubscription(ctx, {
      name: "Spotify",
      amount: 2_190n,
      cycle: "MONTHLY",
      nextChargeDate: d("2026-10-28"),
      cardId: card.id,
      status: "ACTIVE",
    }),
  );
  await transaction((tx) => materializeDueSubscriptions(tx, [{ id: ana.id, today: d("2026-10-28") }]), db);
  await run(ana, at("2026-10-21"), (ctx) =>
    createExpense(ctx, {
      description: "Mercado",
      total: 15_000n,
      purchaseDate: d("2026-10-21"),
      cardId: card.id,
      installments: 1,
    }),
  );
  await run(ana, at("2026-11-20"), (ctx) =>
    createExpense(ctx, {
      description: "Notebook",
      total: 120_000n,
      purchaseDate: d("2026-11-20"),
      cardId: card.id,
      installments: 6,
    }),
  );
  return { ana, card };
}

describe("calendário (getCalendar)", () => {
  it("junta cobranças lançadas, previstas, fechamentos e vencimentos do mês", async () => {
    const { ana, card } = await scenario();
    const events = await getCalendar(queryCtx(ana, at("2026-11-10")), d("2026-11-01"), d("2026-11-30"));

    expect(events.map((e) => [e.date, e.type, e.title, e.amountCents, e.projected])).toEqual([
      // Fatura de nov/26 (fechou em 25/10): só o Mercado de 21/10.
      ["2026-11-05", "INVOICE_DUE", "Vencimento Roxinho", 15_000, false],
      ["2026-11-20", "INSTALLMENT", "Notebook (1/6)", 20_000, false],
      ["2026-11-25", "INVOICE_CLOSING", "Fechamento Roxinho", null, false],
      ["2026-11-28", "SUBSCRIPTION_CHARGE", "Spotify", 2_190, true],
    ]);
    expect(events.find((e) => e.type === "INVOICE_CLOSING")?.href).toBe(`/cards/${card.id}/invoices/2026-12`);
  });

  it("não duplica a cobrança da assinatura depois que ela é lançada", async () => {
    const { ana } = await scenario();
    await transaction((tx) => materializeDueSubscriptions(tx, [{ id: ana.id, today: d("2026-11-28") }]), db);
    const events = await getCalendar(queryCtx(ana, at("2026-11-28")), d("2026-11-01"), d("2026-11-30"));
    const spotify = events.filter((e) => e.title === "Spotify");
    expect(spotify).toHaveLength(1);
    expect(spotify[0]).toMatchObject({ date: "2026-11-28", projected: false, amountCents: 2_190 });
  });

  it("dias passados mostram só o que foi lançado; o vencimento de fatura existente traz o saldo", async () => {
    const { ana } = await scenario();
    const events = await getCalendar(queryCtx(ana, at("2026-12-20")), d("2026-10-26"), d("2026-12-06"));
    expect(events.filter((e) => e.projected)).toEqual([]);
    // Fatura de dez/26: Spotify 28/10 + Notebook 1/6 em 20/11.
    expect(events.find((e) => e.type === "INVOICE_DUE" && e.date === "2026-12-05")?.amountCents).toBe(
      2_190 + 20_000,
    );
  });

  it("aceita até 42 dias (grade de 6 semanas) e recusa intervalos invertidos ou maiores", async () => {
    const ana = await makeUser();
    const ctx = queryCtx(ana, at("2026-11-10"));
    await expect(getCalendar(ctx, d("2026-11-30"), d("2026-11-01"))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(getCalendar(ctx, d("2026-11-01"), d("2026-12-12"))).resolves.toBeDefined();
    await expect(getCalendar(ctx, d("2026-11-01"), d("2026-12-13"))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("listExpenses por mês da compra", () => {
  it("filtra pelo mês e traz o cronograma de parcelas de cada despesa", async () => {
    const { ana } = await scenario();
    const ctx = queryCtx(ana, at("2026-11-20"));

    expect((await listExpenses(ctx)).map((e) => e.description)).toEqual(["Notebook", "Mercado"]);
    const nov = await listExpenses(ctx, { month: parseYearMonth("2026-11") });
    expect(nov.map((e) => e.description)).toEqual(["Notebook"]);
    expect(nov[0]!.schedule.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
    const oct = await listExpenses(ctx, { month: parseYearMonth("2026-10") });
    expect(oct.map((e) => [e.description, e.schedule.length])).toEqual([["Mercado", 1]]);
  });
});
