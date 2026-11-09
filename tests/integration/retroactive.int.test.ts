import { describe, expect, it } from "vitest";

import { parseDateOnly } from "@/shared/domain/date-only";

import { createCard } from "@/modules/cards";
import { createExpense } from "@/modules/expenses";
import { createSubscription, updateSubscription } from "@/modules/subscriptions";

import { at, db, makeUser, run, resetDatabaseBeforeEach } from "../support/db";

resetDatabaseBeforeEach();
const d = parseDateOnly;

/** Fecha dia 25 e vence dia 5: em 08/11/2026 as faturas de set, out e nov já venceram. */
const newCard = { nickname: "Roxinho", brand: "VISA", color: "violet", closingDay: 25, dueDay: 5 } as const;

async function setup(today: string) {
  const u = await makeUser();
  const card = await run(u, at(today), (ctx) => createCard(ctx, newCard));
  return { u, card };
}

const overdue = (userId: string) => db.invoice.count({ where: { userId, status: "OVERDUE" } });

describe("lançamentos anteriores ao FinFlow", () => {
  it("compra parcelada antiga lança só as parcelas de faturas ainda a pagar", async () => {
    const { u, card } = await setup("2026-11-08");
    await run(u, at("2026-11-08"), (ctx) =>
      createExpense(ctx, {
        description: "Notebook",
        total: 1_000_000n,
        purchaseDate: d("2026-08-10"),
        cardId: card.id,
        installments: 10,
      }),
    );
    const charges = await db.charge.findMany({
      where: { userId: u.id },
      include: { invoice: true },
      orderBy: { installmentNumber: "asc" },
    });
    // Parcelas 1 a 3 caíram em faturas que venceram em 05/09, 05/10 e 05/11: pagas fora do FinFlow.
    expect(charges.map((c) => c.installmentNumber)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(charges[0]!.invoice.referenceMonth).toBe("2026-12");
    expect(await overdue(u.id)).toBe(0);
  });

  it("compra esquecida em fatura fechada e ainda não vencida entra nela", async () => {
    const { u, card } = await setup("2026-11-28");
    await run(u, at("2026-11-28"), (ctx) =>
      createExpense(ctx, {
        description: "Mercado",
        total: 5_000n,
        purchaseDate: d("2026-11-24"),
        cardId: card.id,
        installments: 1,
      }),
    );
    const charge = await db.charge.findFirstOrThrow({ where: { userId: u.id }, include: { invoice: true } });
    expect(charge.invoice.referenceMonth).toBe("2026-12");
    expect(charge.invoice.status).toBe("CLOSED");
  });

  it("recusa compra cujas parcelas estão todas em faturas já vencidas", async () => {
    const { u, card } = await setup("2026-11-08");
    await expect(
      run(u, at("2026-11-08"), (ctx) =>
        createExpense(ctx, {
          description: "Tênis",
          total: 30_000n,
          purchaseDate: d("2026-08-10"),
          cardId: card.id,
          installments: 1,
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await db.expense.count({ where: { userId: u.id } })).toBe(0);
  });

  it("assinatura com primeira cobrança antiga começa na primeira fatura ainda a pagar", async () => {
    const { u, card } = await setup("2026-11-08");
    const { id } = await run(u, at("2026-11-08"), (ctx) =>
      createSubscription(ctx, {
        name: "Netflix",
        amount: 5_590n,
        cycle: "MONTHLY",
        nextChargeDate: d("2026-08-28"),
        cardId: card.id,
        status: "ACTIVE",
      }),
    );
    const charges = await db.charge.findMany({ where: { subscriptionId: id }, include: { invoice: true } });
    // 28/08 e 28/09 caem em faturas vencidas; 28/10 cai na fatura que fecha em 25/11.
    expect(charges.map((c) => c.chargeDate.toISOString().slice(0, 10))).toEqual(["2026-10-28"]);
    expect(charges[0]!.invoice.status).toBe("OPEN");
    expect(await overdue(u.id)).toBe(0);
    const sub = await db.subscription.findUniqueOrThrow({ where: { id } });
    expect(sub.nextChargeDate.toISOString().slice(0, 10)).toBe("2026-11-28");
  });
});

describe("validações", () => {
  it("recusa valor menor que o número de parcelas (parcela de zero centavo)", async () => {
    const { u, card } = await setup("2026-11-08");
    await expect(
      run(u, at("2026-11-08"), (ctx) =>
        createExpense(ctx, {
          description: "Chiclete",
          total: 5n,
          purchaseDate: d("2026-11-08"),
          cardId: card.id,
          installments: 10,
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("assinatura em teste não aceita, na edição, cobrança antes do fim do teste", async () => {
    const { u, card } = await setup("2026-11-08");
    const { id } = await run(u, at("2026-11-08"), (ctx) =>
      createSubscription(ctx, {
        name: "Claude Pro",
        amount: 11_000n,
        cycle: "MONTHLY",
        cardId: card.id,
        status: "TRIAL",
        trialEndsOn: d("2026-11-20"),
      }),
    );
    const sub = await db.subscription.findUniqueOrThrow({ where: { id } });
    await expect(
      run(u, at("2026-11-08"), (ctx) =>
        updateSubscription(ctx, {
          id,
          expectedUpdatedAt: sub.updatedAt.toISOString(),
          nextChargeDate: d("2026-11-15"),
        }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
