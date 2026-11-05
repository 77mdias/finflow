import { describe, expect, it } from "vitest";

import { parseDateOnly } from "@/shared/domain/date-only";
import { transaction } from "@/shared/infrastructure/db";

import {
  archiveCard,
  createCard,
  deleteCard,
  getCard,
  listCards,
  setDefaultCard,
  updateCard,
  UpdateCardSchema,
} from "@/modules/cards";
import { deleteCategory, listCategories } from "@/modules/categories";
import { createExpense, deleteExpense, updateExpense } from "@/modules/expenses";
import { registerPayment, updateInvoiceStatuses } from "@/modules/invoices";
import {
  cancelSubscription,
  changeSubscriptionCard,
  changeSubscriptionPrice,
  createSubscription,
  deleteSubscription,
  duplicateSubscription,
  getSubscription,
  listSubscriptions,
  materializeDueSubscriptions,
  pauseSubscription,
  resumeSubscription,
} from "@/modules/subscriptions";

import { at, db, makeUser, queryCtx, run, resetDatabaseBeforeEach } from "../support/db";

resetDatabaseBeforeEach();
const d = parseDateOnly;

const newCard = (closingDay = 25, dueDay = 5, nickname = "Roxinho") =>
  ({ nickname, brand: "VISA", color: "violet", closingDay, dueDay }) as const;

const job = (userId: string, date: string) =>
  transaction(async (tx) => {
    const users = [{ id: userId, today: d(date) }];
    await materializeDueSubscriptions(tx, users);
    await updateInvoiceStatuses(tx, users);
  }, db);

describe("cartões", () => {
  it("cria com fatura corrente, define padrão único e calcula limite (RN-14)", async () => {
    const u = await makeUser();
    const a = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, { ...newCard(), limit: 500_000n }));
    const b = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard(10, 20, "Azul")));
    expect(a.isDefault).toBe(true);
    expect(b.isDefault).toBe(false);
    await run(u, at("2026-11-04"), (ctx) => setDefaultCard(ctx, { id: b.id }));
    expect((await db.card.findMany({ where: { userId: u.id, isDefault: true } })).map((c) => c.id)).toEqual([
      b.id,
    ]);

    await run(u, at("2026-11-04"), (ctx) =>
      createExpense(ctx, {
        description: "Notebook",
        total: 120_000n,
        purchaseDate: d("2026-11-04"),
        cardId: a.id,
        installments: 6,
      }),
    );
    const cards = await listCards(queryCtx(u, at("2026-11-04")));
    const roxinho = cards.find((c) => c.id === a.id)!;
    expect(roxinho.currentInvoice?.referenceMonth).toBe("2026-12");
    expect(roxinho.usedLimitCents).toBe(120_000); // parcelas futuras consomem limite
    expect(roxinho.availableLimitCents).toBe(380_000);
    expect((await getCard(queryCtx(u, at("2026-11-04")), a.id)).invoices).toHaveLength(6);
  });

  it("RN-07: mudar o fechamento redistribui cobranças das faturas abertas", async () => {
    const u = await makeUser();
    const card = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard(25, 5)));
    await run(u, at("2026-11-04"), (ctx) =>
      createExpense(ctx, {
        description: "Compra",
        total: 10_000n,
        purchaseDate: d("2026-11-20"),
        cardId: card.id,
        installments: 1,
      }),
    );
    expect((await db.charge.findFirstOrThrow({ include: { invoice: true } })).invoice.referenceMonth).toBe(
      "2026-12",
    );

    // Fechamento passa para o dia 15: a compra de 20/11 vai para a fatura que fecha em 15/12 (vence 05/01).
    const res = await run(u, at("2026-11-04"), (ctx) => updateCard(ctx, { id: card.id, closingDay: 15 }));
    expect(res.invoicesRecalculated).toBeGreaterThan(0);
    const charge = await db.charge.findFirstOrThrow({ include: { invoice: true } });
    expect(charge.invoice.referenceMonth).toBe("2027-01");
    expect(charge.invoice.closingDate.toISOString().slice(0, 10)).toBe("2026-12-15");
    const totals = await db.invoice.findMany({
      where: { cardId: card.id },
      orderBy: { referenceMonth: "asc" },
    });
    expect(totals.map((i) => [i.referenceMonth, i.totalCents])).toEqual([
      ["2026-12", 0n],
      ["2027-01", 10_000n],
    ]);
  });

  it("concorrência otimista na edição (CONFLICT)", async () => {
    const u = await makeUser();
    const card = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard()));
    await run(u, at("2026-11-04"), (ctx) =>
      updateCard(ctx, { id: card.id, nickname: "Novo", expectedUpdatedAt: card.updatedAt }),
    );
    await expect(
      run(u, at("2026-11-04"), (ctx) =>
        updateCard(ctx, { id: card.id, nickname: "Velho", expectedUpdatedAt: card.updatedAt }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("editar com a instituição vazia remove a instituição", async () => {
    const u = await makeUser();
    const card = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, { ...newCard(), issuer: "Nubank" }));
    const input = UpdateCardSchema.parse({ id: card.id, issuer: "" });
    const res = await run(u, at("2026-11-04"), (ctx) => updateCard(ctx, input));
    expect(res.card.issuer).toBeNull();
  });

  it("arquivar exige destino para assinaturas; excluir só sem histórico (RF-013, RF-014)", async () => {
    const u = await makeUser();
    const a = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard()));
    const b = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard(10, 20, "Azul")));
    const sub = await run(u, at("2026-11-04"), (ctx) =>
      createSubscription(ctx, {
        name: "Netflix",
        amount: 5_590n,
        cycle: "MONTHLY",
        nextChargeDate: d("2026-11-12"),
        cardId: a.id,
        status: "ACTIVE",
      }),
    );
    await expect(run(u, at("2026-11-04"), (ctx) => archiveCard(ctx, { id: a.id }))).rejects.toMatchObject({
      code: "CARD_HAS_ACTIVE_SUBSCRIPTIONS",
    });
    expect(
      await run(u, at("2026-11-04"), (ctx) => archiveCard(ctx, { id: a.id, reassignTo: b.id })),
    ).toMatchObject({ moved: 1 });
    expect((await db.subscription.findUniqueOrThrow({ where: { id: sub.id } })).cardId).toBe(b.id);
    await expect(
      run(u, at("2026-11-04"), (ctx) =>
        createExpense(ctx, {
          description: "X",
          total: 100n,
          purchaseDate: d("2026-11-04"),
          cardId: a.id,
          installments: 1,
        }),
      ),
    ).rejects.toMatchObject({ code: "CARD_ARCHIVED" });

    const empty = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard(1, 10, "Vazio")));
    expect(await run(u, at("2026-11-04"), (ctx) => deleteCard(ctx, { id: empty.id }))).toEqual({
      deleted: true,
    });
    await expect(run(u, at("2026-11-04"), (ctx) => deleteCard(ctx, { id: b.id }))).rejects.toMatchObject({
      code: "CARD_HAS_HISTORY",
    });
  });
});

describe("assinaturas", () => {
  it("teste gratuito converte e cobra no fim do teste (RF-026)", async () => {
    const u = await makeUser();
    const card = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard()));
    const s = await run(u, at("2026-11-04"), (ctx) =>
      createSubscription(ctx, {
        name: "ChatGPT",
        amount: 10_000n,
        cycle: "MONTHLY",
        cardId: card.id,
        status: "TRIAL",
        trialEndsOn: d("2026-11-10"),
      }),
    );
    await job(u.id, "2026-11-09");
    expect((await db.subscription.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("TRIAL");
    expect(await db.charge.count()).toBe(0);
    await job(u.id, "2026-11-10");
    const after = await db.subscription.findUniqueOrThrow({ where: { id: s.id } });
    expect(after.status).toBe("ACTIVE");
    expect(after.nextChargeDate.toISOString().slice(0, 10)).toBe("2026-12-10");
    expect(await db.charge.count()).toBe(1);
  });

  it("reajuste, troca de cartão, pausa/retomada e cancelamento", async () => {
    const u = await makeUser();
    const a = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard()));
    const b = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard(10, 20, "Azul")));
    const s = await run(u, at("2026-11-04"), (ctx) =>
      createSubscription(ctx, {
        name: "Spotify",
        amount: 2_190n,
        cycle: "MONTHLY",
        nextChargeDate: d("2026-11-05"),
        cardId: a.id,
        status: "ACTIVE",
      }),
    );
    await job(u.id, "2026-11-05");
    await run(u, at("2026-11-06"), (ctx) =>
      changeSubscriptionPrice(ctx, { id: s.id, amount: 2_390n, effectiveFrom: d("2026-12-01") }),
    );
    await run(u, at("2026-11-06"), (ctx) => changeSubscriptionCard(ctx, { id: s.id, cardId: b.id }));
    await job(u.id, "2026-12-05");
    const charges = await db.charge.findMany({ orderBy: { chargeDate: "asc" } });
    expect(charges.map((c) => [c.chargeDate.toISOString().slice(0, 10), c.amountCents, c.cardId])).toEqual([
      ["2026-11-05", 2_190n, a.id],
      ["2026-12-05", 2_390n, b.id],
    ]);
    expect((await getSubscription(queryCtx(u, at("2026-12-05")), s.id)).amountCents).toBe(2_390);

    await run(u, at("2026-12-06"), (ctx) => pauseSubscription(ctx, { id: s.id }));
    await job(u.id, "2027-01-05");
    expect(await db.charge.count()).toBe(2);
    await expect(
      run(u, at("2027-01-06"), (ctx) => pauseSubscription(ctx, { id: s.id })),
    ).rejects.toMatchObject({
      code: "INVALID_STATE_TRANSITION",
    });
    await run(u, at("2027-01-06"), (ctx) =>
      resumeSubscription(ctx, { id: s.id, nextChargeDate: d("2027-01-20") }),
    );
    await run(u, at("2027-01-06"), (ctx) =>
      cancelSubscription(ctx, { id: s.id, effectiveOn: d("2027-02-20") }),
    );
    await job(u.id, "2027-03-31");
    // Cobra 20/01 (antes do cancelamento efetivo), não cobra 20/02 nem depois.
    expect(
      (await db.charge.findMany({ orderBy: { chargeDate: "asc" } })).map((c) =>
        c.chargeDate.toISOString().slice(0, 10),
      ),
    ).toEqual(["2026-11-05", "2026-12-05", "2027-01-20"]);
    const list = await listSubscriptions(queryCtx(u, at("2027-03-31")), { status: "CANCELED" });
    expect(list).toHaveLength(1);
    expect(list[0]!.nextChargeDate).toBeNull();

    const copy = await run(u, at("2027-03-31"), (ctx) => duplicateSubscription(ctx, { id: s.id }));
    expect((await db.subscription.findUniqueOrThrow({ where: { id: copy.id } })).status).toBe("ACTIVE");
    await expect(
      run(u, at("2027-03-31"), (ctx) => deleteSubscription(ctx, { id: s.id })),
    ).rejects.toMatchObject({
      code: "SUBSCRIPTION_HAS_CHARGES",
    });
  });
});

describe("despesas e categorias", () => {
  it("bloqueia edição financeira com parcela em fatura fechada (RF-032, RF-033)", async () => {
    const u = await makeUser();
    const card = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard()));
    const e = await run(u, at("2026-11-04"), (ctx) =>
      createExpense(ctx, {
        description: "Celular",
        total: 300_000n,
        purchaseDate: d("2026-11-04"),
        cardId: card.id,
        installments: 3,
      }),
    );
    // Ainda tudo aberto: pode mudar parcelas
    const edited = await run(u, at("2026-11-05"), (ctx) => updateExpense(ctx, { id: e.id, installments: 2 }));
    expect(edited.schedule.map((s) => s.amountCents)).toEqual([150_000, 150_000]);

    await job(u.id, "2026-11-26"); // fecha dez/26
    await expect(
      run(u, at("2026-11-26"), (ctx) => updateExpense(ctx, { id: e.id, total: 1_000n })),
    ).rejects.toMatchObject({
      code: "INVOICE_LOCKED",
    });
    // Descrição pode mudar: só parcelas abertas são renomeadas
    const renamed = await run(u, at("2026-11-26"), (ctx) =>
      updateExpense(ctx, { id: e.id, description: "iPhone" }),
    );
    expect(renamed.description).toBe("iPhone");
    const descs = (await db.charge.findMany({ orderBy: { installmentNumber: "asc" } })).map(
      (c) => c.description,
    );
    expect(descs).toEqual(["Celular (1/2)", "iPhone (2/2)"]);

    await expect(run(u, at("2026-11-26"), (ctx) => deleteExpense(ctx, { id: e.id }))).rejects.toMatchObject({
      code: "INVOICE_LOCKED",
    });
    const del = await run(u, at("2026-11-26"), (ctx) =>
      deleteExpense(ctx, { id: e.id, confirmClosedInvoices: true }),
    );
    expect(del.affectedInvoices).toHaveLength(2);
    expect((await db.invoice.findMany()).every((i) => i.totalCents === 0n)).toBe(true);
    expect((await db.invoice.findFirstOrThrow({ where: { referenceMonth: "2026-12" } })).status).toBe("PAID"); // zerada
  });

  it("excluir categoria realoca tudo para 'Outros' (RF-071)", async () => {
    const u = await makeUser();
    const card = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard()));
    const cats = await listCategories(db, u.id);
    const streaming = cats.find((c) => c.name === "Streaming")!;
    const outros = cats.find((c) => c.isSystem)!;
    await run(u, at("2026-11-04"), (ctx) =>
      createSubscription(ctx, {
        name: "Netflix",
        amount: 5_590n,
        cycle: "MONTHLY",
        nextChargeDate: d("2026-11-01"),
        cardId: card.id,
        status: "ACTIVE",
        categoryId: streaming.id,
      }),
    );
    const res = await run(u, at("2026-11-04"), (ctx) => deleteCategory(ctx, { id: streaming.id }));
    expect(res.reassigned).toBe(2); // assinatura + cobrança materializada
    expect((await db.charge.findFirstOrThrow()).categoryId).toBe(outros.id);
    await expect(
      run(u, at("2026-11-04"), (ctx) => deleteCategory(ctx, { id: outros.id })),
    ).rejects.toMatchObject({
      code: "CATEGORY_IS_SYSTEM",
    });
  });

  it("pagamento futuro é recusado", async () => {
    const u = await makeUser();
    const card = await run(u, at("2026-11-04"), (ctx) => createCard(ctx, newCard()));
    await run(u, at("2026-11-04"), (ctx) =>
      createExpense(ctx, {
        description: "X",
        total: 1_000n,
        purchaseDate: d("2026-11-04"),
        cardId: card.id,
        installments: 1,
      }),
    );
    const inv = await db.invoice.findFirstOrThrow({ where: { referenceMonth: "2026-12" } });
    await expect(
      run(u, at("2026-11-04"), (ctx) =>
        registerPayment(ctx, { invoiceId: inv.id, amountCents: 100n, paidOn: d("2026-12-01") }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
