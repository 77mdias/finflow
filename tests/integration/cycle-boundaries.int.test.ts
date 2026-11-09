import { describe, expect, it } from "vitest";

import { parseDateOnly } from "@/shared/domain/date-only";
import { transaction } from "@/shared/infrastructure/db";

import { createCard, updateCard } from "@/modules/cards";
import { getCalendar } from "@/modules/dashboard";
import { createExpense } from "@/modules/expenses";
import { updateInvoiceStatuses } from "@/modules/invoices";

import { at, db, makeUser, queryCtx, run, resetDatabaseBeforeEach } from "../support/db";

resetDatabaseBeforeEach();
const d = parseDateOnly;

const card = (closingDay: number, dueDay: number) =>
  ({ nickname: "Roxinho", brand: "VISA", color: "violet", closingDay, dueDay }) as const;

const buy = (u: Awaited<ReturnType<typeof makeUser>>, cardId: string, date: string, total: bigint) =>
  run(u, at(date), (ctx) =>
    createExpense(ctx, {
      description: `Compra ${date}`,
      total,
      purchaseDate: d(date),
      cardId,
      installments: 1,
    }),
  );

const statuses = (userId: string, date: string) =>
  transaction((tx) => updateInvoiceStatuses(tx, [{ id: userId, today: d(date) }]), db);

const invoicesOf = async (cardId: string) =>
  (
    await db.invoice.findMany({
      where: { cardId },
      orderBy: { referenceMonth: "asc" },
      include: { charges: { select: { description: true } } },
    })
  ).map((i) => ({
    ref: i.referenceMonth,
    closing: i.closingDate.toISOString().slice(0, 10),
    due: i.dueDate.toISOString().slice(0, 10),
    status: i.status,
    charges: i.charges.map((c) => c.description).sort(),
  }));

describe("calendário: ausência de fatura no passado é nada devido (regra 2)", () => {
  it("não inventa ciclos anteriores ao ciclo atual do cartão", async () => {
    const u = await makeUser();
    // Cartão criado em 04/11 (fecha 25, vence 5): o ciclo atual fecha em 25/11.
    await run(u, at("2026-11-04"), (ctx) => createCard(ctx, card(25, 5)));

    const october = await getCalendar(queryCtx(u, at("2026-11-04")), d("2026-10-01"), d("2026-10-31"));
    expect(october).toEqual([]);

    // O ciclo que venceria em 05/11 fechou antes do cartão existir: não há o que pagar.
    const november = await getCalendar(queryCtx(u, at("2026-11-04")), d("2026-11-01"), d("2026-11-30"));
    expect(november.map((e) => [e.date, e.type])).toEqual([["2026-11-25", "INVOICE_CLOSING"]]);
  });
});

describe("mudança de ciclo do cartão (regra 3)", () => {
  it("a fatura aberta mantém as datas quando o novo fechamento já passou", async () => {
    const u = await makeUser();
    // Fecha 10, vence 20: a fatura aberta de nov/26 fecha em 10/11 e vence em 20/11.
    const c = await run(u, at("2026-10-12"), (ctx) => createCard(ctx, card(10, 20)));
    await buy(u, c.id, "2026-10-15", 10_000n);
    await buy(u, c.id, "2026-10-30", 5_000n);

    // Em 08/11 passa a fechar 25 e vencer 5: pelo novo ciclo, nov/26 teria fechado em 25/10 e vencido em 05/11.
    await run(u, at("2026-11-08"), (ctx) => updateCard(ctx, { id: c.id, closingDay: 25, dueDay: 5 }));
    await statuses(u.id, "2026-11-08");

    expect(await invoicesOf(c.id)).toEqual([
      {
        ref: "2026-11",
        closing: "2026-11-10",
        due: "2026-11-20",
        status: "OPEN",
        charges: ["Compra 2026-10-15"],
      },
      // A compra de 30/10 cai, pelo novo ciclo, na fatura que fecha em 25/11.
      {
        ref: "2026-12",
        closing: "2026-11-25",
        due: "2026-12-05",
        status: "OPEN",
        charges: ["Compra 2026-10-30"],
      },
    ]);
  });

  it("cobrança que o novo ciclo mandaria para uma fatura que já teria fechado fica na fatura aberta", async () => {
    const u = await makeUser();
    // Fecha 25, vence 5, criado em 01/11: a aberta é dez/26 (fecha 25/11, vence 05/12).
    const c = await run(u, at("2026-11-01"), (ctx) => createCard(ctx, card(25, 5)));
    await buy(u, c.id, "2026-11-02", 10_000n);

    // Em 08/11 passa a fechar 5 e vencer 15: pelo novo ciclo a compra de 02/11 iria para a fatura
    // que fechou em 05/11, antes da mudança. Ela fica em dez/26, que passa a fechar em 05/12.
    await run(u, at("2026-11-08"), (ctx) => updateCard(ctx, { id: c.id, closingDay: 5, dueDay: 15 }));

    expect(await invoicesOf(c.id)).toEqual([
      {
        ref: "2026-12",
        closing: "2026-12-05",
        due: "2026-12-15",
        status: "OPEN",
        charges: ["Compra 2026-11-02"],
      },
    ]);
  });

  it("recusa o novo ciclo quando a fatura de hoje por ele já fechou", async () => {
    const u = await makeUser();
    // Fecha 25, vence 5: nov/26 fechou em 25/10 e venceu em 05/11; a aberta é dez/26.
    const c = await run(u, at("2026-10-01"), (ctx) => createCard(ctx, card(25, 5)));
    await buy(u, c.id, "2026-10-05", 10_000n);
    await statuses(u.id, "2026-11-08");

    // Fechar 10 e vencer 20 poria as compras de hoje em nov/26 (fecha 10/11), que já fechou.
    await expect(
      run(u, at("2026-11-08"), (ctx) => updateCard(ctx, { id: c.id, closingDay: 10, dueDay: 20 })),
    ).rejects.toMatchObject({ code: "INVOICE_LOCKED", message: expect.stringContaining("10/11") });
    expect(await db.card.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({
      closingDay: 25,
      dueDay: 5,
    });

    // A partir de 10/11 as compras do dia já vão para dez/26 pelo novo ciclo.
    await expect(
      run(u, at("2026-11-10"), (ctx) => updateCard(ctx, { id: c.id, closingDay: 10, dueDay: 20 })),
    ).resolves.toBeDefined();
  });
});
