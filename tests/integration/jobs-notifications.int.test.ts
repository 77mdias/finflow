import { describe, expect, it } from "vitest";

import { parseDateOnly } from "@/shared/domain/date-only";
import { fixedClock } from "@/shared/infrastructure/clock";
import { transaction } from "@/shared/infrastructure/db";

import { exportUserData, onUserCreated, purgeAndRetention, requestAccountDeletion } from "@/modules/accounts";
import { createCard } from "@/modules/cards";
import { getCardsOverview, getDashboard, getInvoiceView, getProjection } from "@/modules/dashboard";
import { createExpense } from "@/modules/expenses";
import { registerPayment } from "@/modules/invoices";
import { runDailyJob, runPurgeJob, runRemindersJob, runJob } from "@/modules/jobs";
import {
  applyUnsubscribe,
  createUnsubscribeToken,
  handleResendEvent,
  listNotifications,
  markAllNotificationsRead,
  unreadCount,
  updateNotificationPreferences,
  verifyUnsubscribeToken,
} from "@/modules/notifications";
import { createSubscription } from "@/modules/subscriptions";

import { at, db, mail, makeUser, queryCtx, run, resetDatabaseBeforeEach } from "../support/db";

resetDatabaseBeforeEach();
const d = parseDateOnly;
const deps = (iso: string) => ({ db, clock: fixedClock(iso), mailer: mail });

async function scenario() {
  const u = await makeUser();
  const card = await run(u, at("2026-11-01"), (ctx) =>
    createCard(ctx, { nickname: "Roxinho", brand: "VISA", color: "violet", closingDay: 25, dueDay: 5 }),
  );
  await run(u, at("2026-11-01"), (ctx) =>
    createExpense(ctx, {
      description: "TV",
      total: 84_217n,
      purchaseDate: d("2026-11-01"),
      cardId: card.id,
      installments: 1,
    }),
  );
  await run(u, at("2026-11-01"), (ctx) =>
    createSubscription(ctx, {
      name: "Netflix",
      amount: 5_590n,
      cycle: "MONTHLY",
      nextChargeDate: d("2026-12-03"),
      cardId: card.id,
      status: "ACTIVE",
    }),
  );
  return { u, card };
}

describe("job diário", () => {
  it("registra job_run, é idempotente e impede execução concorrente", async () => {
    const { card } = await scenario();
    const r1 = await runDailyJob(deps(at("2026-11-26")));
    expect(r1.status).toBe("SUCCEEDED");
    expect(r1.stats).toMatchObject({ usersProcessed: 1, invoicesClosed: 1, errors: 0 });
    const r2 = await runDailyJob(deps(at("2026-11-26")));
    expect(r2.stats.invoicesClosed).toBe(0);
    expect(
      (await db.invoice.findFirstOrThrow({ where: { cardId: card.id, referenceMonth: "2026-12" } })).status,
    ).toBe("CLOSED");
    // Fatura corrente (jan/27) garantida
    expect(await db.invoice.count({ where: { cardId: card.id, referenceMonth: "2027-01" } })).toBe(1);

    // Trava: com um RUNNING ativo, nova execução recebe CONFLICT
    await db.jobRun.create({ data: { job: "DAILY" } });
    await expect(runDailyJob(deps(at("2026-11-27")))).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.jobRun.count({ where: { job: "DAILY", status: "SUCCEEDED" } })).toBe(2);
  });

  it("reconcilia cache divergente de total_cents (RN-16)", async () => {
    const { card } = await scenario();
    await db.invoice.updateMany({
      where: { cardId: card.id, referenceMonth: "2026-12" },
      data: { totalCents: 1n },
    });
    const r = await runDailyJob(deps(at("2026-11-02")));
    expect(r.stats.reconciliationMismatches).toBe(1);
    expect(
      (await db.invoice.findFirstOrThrow({ where: { cardId: card.id, referenceMonth: "2026-12" } }))
        .totalCents,
    ).toBe(84_217n);
  });

  it("falha de um job marca FAILED", async () => {
    const r = await runJob(db, "BACKUP", async () => {
      throw new Error("boom");
    });
    expect(r.status).toBe("FAILED");
    expect((await db.jobRun.findUniqueOrThrow({ where: { id: r.jobRunId } })).error).toContain("boom");
  });
});

describe("lembretes", () => {
  it("vencimento + cobrança de assinatura: e-mail único, in-app e retentativa", async () => {
    const { u } = await scenario();
    await runDailyJob(deps(at("2026-11-26")));
    mail.failNext = 1; // 1º envio falha
    const r1 = await runRemindersJob(deps(at("2026-12-02")));
    expect(r1.stats).toMatchObject({ notificationsCreated: 4, emailsFailed: 1, emailsSent: 1 });
    // Mesmo dia: não duplica; reenvia o que falhou
    const r2 = await runRemindersJob(deps(at("2026-12-02")));
    expect(r2.stats).toMatchObject({ notificationsCreated: 0, emailsSent: 1, emailsFailed: 0 });
    expect(mail.sent.map((m) => m.subject).sort()).toEqual([
      "Fatura do Roxinho vence em 3 dias — R$ 842,17",
      "Netflix será cobrada amanhã — R$ 55,90",
    ]);
    expect(mail.sent[0]!.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(mail.sent.every((m) => m.idempotencyKey)).toBe(true);

    const ctx = queryCtx(u, at("2026-12-02"));
    expect(await unreadCount(ctx)).toBe(2);
    expect((await listNotifications(ctx)).items).toHaveLength(2);
    await run(u, at("2026-12-02"), (c) => markAllNotificationsRead(c));
    expect(await unreadCount(ctx)).toBe(0);
  });

  it("resumo diário agrupa; fatura quitada antes do envio é descartada", async () => {
    const { u, card } = await scenario();
    await runDailyJob(deps(at("2026-11-26")));
    await run(u, at("2026-11-26"), (ctx) => updateNotificationPreferences(ctx, { dailyDigest: true }));
    // Gera sem enviar: simulamos falha total do provedor
    mail.failNext = 1;
    await runRemindersJob(deps(at("2026-12-02")));
    expect(mail.sent).toHaveLength(0);
    // Usuário paga a fatura antes do reenvio
    const inv = await db.invoice.findFirstOrThrow({ where: { cardId: card.id, referenceMonth: "2026-12" } });
    await run(u, at("2026-12-02"), (ctx) =>
      registerPayment(ctx, { invoiceId: inv.id, amountCents: 84_217n, paidOn: d("2026-12-02") }),
    );
    const r = await runRemindersJob(deps(at("2026-12-02")));
    expect(r.stats).toMatchObject({ emailsSkipped: 1, emailsSent: 1 });
    expect(mail.sent).toHaveLength(1);
  });

  it("descadastro one-click por token HMAC", async () => {
    const { u } = await scenario();
    const token = createUnsubscribeToken(u.id, "SUBSCRIPTION_CHARGE");
    expect(verifyUnsubscribeToken(token).uid).toBe(u.id);
    expect(() => verifyUnsubscribeToken(token.slice(0, -2) + "xx")).toThrow();
    expect(await applyUnsubscribe(db, token)).toBe("SUBSCRIPTION_CHARGE");
    expect(
      (await db.notificationPreference.findUniqueOrThrow({ where: { userId: u.id } })).subscriptionDaysBefore,
    ).toBeNull();
    await runDailyJob(deps(at("2026-11-26")));
    const r = await runRemindersJob(deps(at("2026-12-02")));
    expect(mail.sent.map((m) => m.subject)).toEqual(["Fatura do Roxinho vence em 3 dias — R$ 842,17"]);
    expect(r.stats.emailsSent).toBe(1);
  });

  it("webhook: bounce permanente suprime e-mails; eventos repetidos são ignorados", async () => {
    const { u } = await scenario();
    const event = {
      type: "email.bounced",
      data: { email_id: "x", to: [u.email.toUpperCase()], bounce: { type: "Permanent" } },
    };
    expect(await handleResendEvent(db, "evt_1", event)).toEqual({ duplicate: false });
    expect(await handleResendEvent(db, "evt_1", event)).toEqual({ duplicate: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).emailSuppressedAt).not.toBeNull();
    await runDailyJob(deps(at("2026-11-26")));
    const r = await runRemindersJob(deps(at("2026-12-02")));
    expect(mail.sent).toHaveLength(0);
    expect(r.stats.notificationsCreated).toBe(2); // apenas in-app
  });
});

describe("dashboard e projeção", () => {
  it("projeção, fatura com previstos e total comprometido (RF-043, RF-050, RF-055)", async () => {
    const { u, card } = await scenario();
    const ctx = queryCtx(u, at("2026-11-04"));
    const projection = await getProjection(ctx, 3);
    expect(projection.months.map((m) => [m.referenceMonth, m.totalCents])).toEqual([
      ["2026-12", 84_217],
      ["2027-01", 5_590],
      ["2027-02", 5_590],
    ]);
    const jan = await getInvoiceView(ctx, card.id, "2027-01");
    expect(jan.status).toBe("FUTURE");
    expect(jan.charges).toMatchObject([
      { projected: true, description: "Netflix", chargeDate: "2026-12-03", amountCents: 5_590 },
    ]);
    expect(jan.prev).toBe("2026-12");

    // Em 30/11 a fatura de dezembro já fechou, mas ainda conta no comprometido de dezembro.
    await runDailyJob(deps(at("2026-11-30")));
    const dash = await getDashboard(queryCtx(u, at("2026-11-30")), "2026-12");
    expect(dash.committedThisMonthCents).toBe(84_217);
    expect(dash.recurringMonthlyCents).toBe(5_590);
    expect(dash.upcoming.map((e) => e.type)).toEqual(["SUBSCRIPTION_CHARGE", "INVOICE_DUE"]);
    expect(dash.byCategory).toHaveLength(1);
    // Fechou dia 25: a fatura atual do cartão passa a ser a de janeiro, só com a Netflix prevista.
    expect(dash.cards).toMatchObject([
      {
        id: card.id,
        currentInvoice: {
          referenceMonth: "2027-01",
          status: "OPEN",
          totalCents: 5_590,
          projectedCents: 5_590,
        },
      },
    ]);
    // /cards mostra a mesma fatura atual que o painel (a projeção de 1 ciclo basta).
    expect(await getCardsOverview(queryCtx(u, at("2026-11-30")))).toEqual(dash.cards);
    // Variação: o mês anterior de janeiro é o comprometido de dezembro.
    const january = await getDashboard(queryCtx(u, at("2026-11-30")), "2027-01");
    expect(january.committedThisMonthCents).toBe(5_590);
    expect(january.previousMonthCents).toBe(84_217);
  });
});

describe("conta e LGPD", () => {
  it("onboarding, exportação, exclusão e purge após 30 dias", async () => {
    const { u } = await scenario();
    await transaction((tx) => onUserCreated(tx, u.id), db);
    expect(await db.consent.count({ where: { userId: u.id } })).toBe(2);
    await transaction((tx) => onUserCreated(tx, u.id), db); // idempotente
    expect(await db.consent.count({ where: { userId: u.id } })).toBe(2);
    expect(await db.category.count({ where: { userId: u.id } })).toBe(14);

    const exported = await exportUserData(db, u.id);
    expect(exported.schemaVersion).toBe(1);
    expect((exported.charges as unknown[]).length).toBe(1);
    expect(JSON.stringify(exported)).not.toContain("ipHash");

    await expect(
      run(u, at("2026-11-04"), (ctx) => requestAccountDeletion(ctx, { confirmEmail: "outro@x.com" })),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    const del = await run(u, at("2026-11-04"), (ctx) =>
      requestAccountDeletion(ctx, { confirmEmail: u.email }),
    );
    expect(del.purgeAfter).toBe("2026-12-04");

    expect((await purgeAndRetention(db, new Date(at("2026-11-20")))).accountsPurged).toBe(0);
    const r = await runPurgeJob(deps(at("2026-12-05")));
    expect(r.stats.accountsPurged).toBe(1);
    expect(await db.user.count()).toBe(0);
    expect(await db.charge.count()).toBe(0);
  });
});
