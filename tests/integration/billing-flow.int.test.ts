import { describe, expect, it } from "vitest";

import { parseDateOnly } from "@/shared/domain/date-only";
import { transaction } from "@/shared/infrastructure/db";

import { createCard } from "@/modules/cards";
import { createExpense } from "@/modules/expenses";
import {
  createAdjustment,
  deletePayment,
  getInvoice,
  registerPayment,
  updateInvoiceStatuses,
} from "@/modules/invoices";
import { createSubscription, materializeDueSubscriptions } from "@/modules/subscriptions";

import { at, db, makeUser, queryCtx, run, resetDatabaseBeforeEach } from "../support/db";

resetDatabaseBeforeEach();

const d = parseDateOnly;

async function invoiceByRef(cardId: string, referenceMonth: string) {
  return db.invoice.findUniqueOrThrow({ where: { cardId_referenceMonth: { cardId, referenceMonth } } });
}

async function dailyJob(userId: string, date: string) {
  return transaction(async (tx) => {
    const users = [{ id: userId, today: d(date) }];
    const m = await materializeDueSubscriptions(tx, users);
    const s = await updateInvoiceStatuses(tx, users);
    return { ...m, ...s };
  }, db);
}

describe("fluxo de faturamento (FLOW_MAP §14)", () => {
  it("assinaturas + parcelamento + fechamento + pagamentos + vencimento", async () => {
    const ana = await makeUser();
    const card = await run(ana, at("2026-10-20"), (ctx) =>
      createCard(ctx, {
        nickname: "Roxinho",
        brand: "MASTERCARD",
        color: "violet",
        closingDay: 25,
        dueDay: 5,
      }),
    );
    expect(card.isDefault).toBe(true);

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
    await run(ana, at("2026-10-20"), (ctx) =>
      createSubscription(ctx, {
        name: "Netflix",
        amount: 5_590n,
        cycle: "MONTHLY",
        nextChargeDate: d("2026-11-12"),
        cardId: card.id,
        status: "ACTIVE",
      }),
    );
    // Job diário em dias distintos materializa cada ocorrência uma única vez.
    expect((await dailyJob(ana.id, "2026-10-28")).chargesMaterialized).toBe(1);
    expect((await dailyJob(ana.id, "2026-10-28")).chargesMaterialized).toBe(0);
    expect((await dailyJob(ana.id, "2026-11-12")).chargesMaterialized).toBe(1);

    const notebook = await run(ana, at("2026-11-20"), (ctx) =>
      createExpense(ctx, {
        description: "Notebook",
        total: 120_000n,
        purchaseDate: d("2026-11-20"),
        cardId: card.id,
        installments: 6,
      }),
    );
    expect(notebook.schedule.map((s) => s.referenceMonth)).toEqual([
      "2026-12",
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
    ]);

    let dec = await invoiceByRef(card.id, "2026-12");
    expect(dec.totalCents).toBe(27_780n);
    expect(dec.status).toBe("OPEN");

    // 25/11: fecha a fatura de dezembro; Spotify de 28/11 ainda não existe.
    await dailyJob(ana.id, "2026-11-25");
    dec = await invoiceByRef(card.id, "2026-12");
    expect(dec.status).toBe("CLOSED");
    expect(dec.closedAt).not.toBeNull();

    // 28/11: Spotify entra na fatura de janeiro.
    await dailyJob(ana.id, "2026-11-28");
    expect((await invoiceByRef(card.id, "2027-01")).totalCents).toBe(22_190n);

    // Pagamento parcial → PARTIALLY_PAID
    await run(ana, at("2026-11-30"), (ctx) =>
      registerPayment(ctx, { invoiceId: dec.id, amountCents: 10_000n, paidOn: d("2026-11-30") }),
    );
    expect((await invoiceByRef(card.id, "2026-12")).status).toBe("PARTIALLY_PAID");

    // Pagamento acima do saldo é recusado
    await expect(
      run(ana, at("2026-11-30"), (ctx) =>
        registerPayment(ctx, { invoiceId: dec.id, amountCents: 20_000n, paidOn: d("2026-11-30") }),
      ),
    ).rejects.toMatchObject({
      code: "PAYMENT_EXCEEDS_BALANCE",
      message: "O valor excede o saldo de R$ 177,80.",
    });

    // 06/12: vencida
    await dailyJob(ana.id, "2026-12-06");
    expect((await invoiceByRef(card.id, "2026-12")).status).toBe("OVERDUE");

    // Quita o saldo → PAID
    const paid = await run(ana, at("2026-12-06"), (ctx) =>
      registerPayment(ctx, { invoiceId: dec.id, amountCents: 17_780n, paidOn: d("2026-12-06") }),
    );
    expect(paid.status).toBe("PAID");

    // Desfazer o pagamento volta para OVERDUE
    const undone = await run(ana, at("2026-12-06"), (ctx) =>
      deletePayment(ctx, { paymentId: paid.paymentId }),
    );
    expect(undone.status).toBe("OVERDUE");

    // Estorno (ajuste negativo) que zera o saldo → PAID
    await run(ana, at("2026-12-06"), (ctx) =>
      createAdjustment(ctx, { invoiceId: dec.id, amountCents: -17_780n, description: "Estorno" }),
    );
    const detail = await getInvoice(db, ana.id, dec.id);
    expect(detail.status).toBe("PAID");
    expect(detail.totalCents).toBe(10_000);
    expect(detail.charges.map((c) => c.description)).toEqual([
      "Spotify",
      "Netflix",
      "Notebook (1/6)",
      "Estorno",
    ]);
  });

  it("pagamentos concorrentes não excedem o saldo (SELECT … FOR UPDATE)", async () => {
    const u = await makeUser();
    const card = await run(u, at("2026-11-01"), (ctx) =>
      createCard(ctx, { nickname: "C", brand: "OTHER", color: "blue", closingDay: 25, dueDay: 5 }),
    );
    await run(u, at("2026-11-01"), (ctx) =>
      createExpense(ctx, {
        description: "TV",
        total: 100_000n,
        purchaseDate: d("2026-11-01"),
        cardId: card.id,
        installments: 1,
      }),
    );
    const inv = await invoiceByRef(card.id, "2026-12");
    const pay = () =>
      run(u, at("2026-11-02"), (ctx) =>
        registerPayment(ctx, { invoiceId: inv.id, amountCents: 100_000n, paidOn: d("2026-11-02") }),
      );
    const results = await Promise.allSettled([pay(), pay(), pay()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const after = await invoiceByRef(card.id, "2026-12");
    expect(after.paidCents).toBe(100_000n);
    expect(after.status).toBe("PAID");
  });

  it("isola dados entre usuários (recurso alheio ⇒ NOT_FOUND)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const card = await run(a, at("2026-11-01"), (ctx) =>
      createCard(ctx, { nickname: "A", brand: "OTHER", color: "blue", closingDay: 10, dueDay: 20 }),
    );
    const inv = await db.invoice.findFirstOrThrow({ where: { cardId: card.id } });
    await expect(
      run(b, at("2026-11-02"), (ctx) =>
        registerPayment(ctx, { invoiceId: inv.id, amountCents: 1n, paidOn: d("2026-11-02") }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getInvoice(db, b.id, inv.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      run(b, at("2026-11-02"), (ctx) =>
        createSubscription(ctx, {
          name: "X",
          amount: 100n,
          cycle: "MONTHLY",
          nextChargeDate: d("2026-12-01"),
          cardId: card.id,
          status: "ACTIVE",
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(queryCtx(b, at("2026-11-02")).user.id).toBe(b.id);
  });
});
