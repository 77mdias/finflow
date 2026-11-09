import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseDateOnly } from "@/shared/domain/date-only";
import { fixedClock } from "@/shared/infrastructure/clock";

import { createCard } from "@/modules/cards";
import { createExpense } from "@/modules/expenses";
import { forEachUserBatch, runDailyJob, runJob, runRemindersJob } from "@/modules/jobs";
import { createSubscription } from "@/modules/subscriptions";

import { at, db, mail, makeUser, run, resetDatabaseBeforeEach } from "../support/db";

resetDatabaseBeforeEach();
const d = parseDateOnly;
const deps = (iso: string) => ({ db, clock: fixedClock(iso), mailer: mail });

/** Usuário com o Roxinho (fecha 25, vence 5), uma compra em 01/11 e a Netflix em 03/12. */
async function customer() {
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
  return u;
}

describe("job diário (regra 5)", () => {
  it("o erro de um usuário não desfaz o trabalho dos outros", async () => {
    const ana = await customer();
    const bia = await customer();
    // Falha simulada: qualquer cobrança nova da Ana quebra no banco.
    await db.$executeRawUnsafe(`
      CREATE FUNCTION test_fail_charges() RETURNS trigger AS $$
      BEGIN
        IF NEW.user_id = '${ana.id}' THEN RAISE EXCEPTION 'falha simulada'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await db.$executeRawUnsafe(
      `CREATE TRIGGER test_fail_charges BEFORE INSERT ON charges FOR EACH ROW EXECUTE FUNCTION test_fail_charges()`,
    );
    try {
      const r = await runDailyJob(deps(at("2026-12-03")));
      expect(r.status).toBe("PARTIAL");
      expect(r.stats.errors).toBe(1);
      const netflix = (userId: string) =>
        db.charge.count({
          where: { userId, sourceType: "SUBSCRIPTION", chargeDate: new Date("2026-12-03") },
        });
      expect(await netflix(ana.id)).toBe(0);
      expect(await netflix(bia.id)).toBe(1);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_charges ON charges`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS test_fail_charges()`);
    }
  });

  it("retoma depois do cursor e dá a volta até ele", async () => {
    const ids = (await Promise.all(Array.from({ length: 5 }, () => makeUser()))).map((u) => u.id).sort();
    const seen: string[][] = [];
    const checkpoints: string[] = [];
    await forEachUserBatch(
      db,
      fixedClock(at("2026-11-08")),
      async (users) => {
        seen.push(users.map((u) => u.id));
        return {};
      },
      {
        stats: {},
        addError: (e) => {
          throw e;
        },
        batchSize: 2,
        resumeAfter: ids[2]!,
        checkpoint: async (id) => {
          checkpoints.push(id);
        },
      },
    );
    expect(seen).toEqual([[ids[3], ids[4]], [ids[0], ids[1]], [ids[2]]]);
    expect(checkpoints).toEqual([ids[4], ids[1], ids[2]]);
  });

  it("a execução que caiu guarda o cursor; a seguinte começa dele e, ao terminar, limpa", async () => {
    const cursor = randomUUID();
    const failed = await runJob(db, "BACKUP", async ({ checkpoint }) => {
      await checkpoint(cursor);
      throw new Error("timeout");
    });
    expect(failed.status).toBe("FAILED");
    expect((await db.jobRun.findUniqueOrThrow({ where: { id: failed.jobRunId } })).cursor).toBe(cursor);

    let resumedFrom: string | null | undefined;
    const next = await runJob(db, "BACKUP", async ({ resumeAfter, checkpoint }) => {
      resumedFrom = resumeAfter;
      await checkpoint(randomUUID());
    });
    expect(resumedFrom).toBe(cursor);
    expect(next.status).toBe("SUCCEEDED");
    expect((await db.jobRun.findUniqueOrThrow({ where: { id: next.jobRunId } })).cursor).toBeNull();

    // Depois de uma execução completa, a próxima começa do início.
    await runJob(db, "BACKUP", async ({ resumeAfter }) => {
      resumedFrom = resumeAfter;
    });
    expect(resumedFrom).toBeNull();
  });
});

describe("lembretes (regra 6)", () => {
  const types = (userId: string) =>
    db.notification
      .findMany({ where: { userId, channel: "IN_APP" }, orderBy: { type: "asc" } })
      .then((ns) => ns.map((n) => [n.type, n.targetDate.toISOString().slice(0, 10), n.title]));

  it("alerta de vencida usa o status calculado, não o gravado", async () => {
    const u = await customer();
    await runDailyJob(deps(at("2026-11-26"))); // fecha dez/26 (vence 05/12)
    // O job de 06/12 ainda não rodou (a oeste de UTC−3, roda na véspera): a fatura segue CLOSED.
    await runRemindersJob(deps(at("2026-12-06")));
    expect(await types(u.id)).toContainEqual([
      "INVOICE_OVERDUE",
      "2026-12-05",
      "Fatura do Roxinho venceu ontem",
    ]);
  });

  it("lembrete no dia da cobrança sai mesmo depois de o job avançar a data", async () => {
    const u = await customer();
    await db.notificationPreference.upsert({
      where: { userId: u.id },
      create: { userId: u.id, subscriptionDaysBefore: 0 },
      update: { subscriptionDaysBefore: 0 },
    });
    await runDailyJob(deps(at("2026-12-03"))); // lança a Netflix e passa a próxima para 03/01
    await runRemindersJob(deps(at("2026-12-03")));
    expect(await types(u.id)).toContainEqual([
      "SUBSCRIPTION_CHARGE",
      "2026-12-03",
      "Netflix será cobrada hoje — R$ 55,90",
    ]);
  });

  it("um dia sem o job de lembretes é compensado no dia seguinte", async () => {
    const u = await customer();
    await runDailyJob(deps(at("2026-11-26")));
    // O de 02/12 (vencimento em 3 dias, Netflix amanhã) não rodou.
    await runRemindersJob(deps(at("2026-12-03")));
    expect(await types(u.id)).toEqual([
      ["INVOICE_DUE", "2026-12-05", "Fatura do Roxinho vence em 2 dias — R$ 842,17"],
      ["SUBSCRIPTION_CHARGE", "2026-12-03", "Netflix será cobrada hoje — R$ 55,90"],
    ]);
  });
});
