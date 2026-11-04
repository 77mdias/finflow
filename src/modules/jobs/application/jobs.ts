import { env } from "@/shared/config/env";
import type { Clock } from "@/shared/infrastructure/clock";
import type { PrismaClient } from "@/generated/prisma/client";
import { transaction } from "@/shared/infrastructure/db";
import type { Mailer } from "@/shared/infrastructure/mailer";

import { deleteExpiredAuthRecords, purgeAndRetention } from "@/modules/accounts";
import { ensureCurrentInvoices, reconcileInvoiceTotals, updateInvoiceStatuses } from "@/modules/invoices";
import { generateReminders, sendPendingEmails } from "@/modules/notifications";
import { materializeDueSubscriptions } from "@/modules/subscriptions";

import { forEachUserBatch, inLocalWindow, runJob, type JobRunResult } from "./runner";

export interface JobDeps {
  db: PrismaClient;
  clock: Clock;
  mailer: Mailer;
}

/**
 * Job diário (ARCHITECTURE §7): por lote de usuários, em uma transação —
 * materializa assinaturas (inclui conversão de testes), fecha/vence faturas,
 * garante a fatura corrente e reconcilia caches. Idempotente.
 */
export function runDailyJob({ db, clock }: JobDeps): Promise<JobRunResult> {
  return runJob(db, "DAILY", async ({ stats, addError }) => {
    await forEachUserBatch(
      db,
      clock,
      (users) =>
        transaction(async (tx) => {
          const batch = users.map((u) => ({ id: u.id, today: u.today }));
          const a = await materializeDueSubscriptions(tx, batch);
          const b = await updateInvoiceStatuses(tx, batch);
          const c = await ensureCurrentInvoices(tx, batch);
          const d = await reconcileInvoiceTotals(
            tx,
            batch.map((u) => u.id),
          );
          return { ...a, ...b, ...c, ...d };
        }, db),
      { stats, addError },
    );
    Object.assign(stats, await deleteExpiredAuthRecords(db, clock.now()));
  });
}

/** Job de lembretes (RF-060..RF-067): gera notificações e envia e-mails pendentes. */
export function runRemindersJob({ db, clock, mailer }: JobDeps): Promise<JobRunResult> {
  return runJob(db, "REMINDERS", async ({ stats, addError }) => {
    await forEachUserBatch(
      db,
      clock,
      async (users) => {
        const batch = users.map((u) => ({ id: u.id, today: u.today }));
        const generated = await transaction((tx) => generateReminders(tx, batch), db);
        const sent = await sendPendingEmails(
          db,
          mailer,
          batch.map((u) => u.id),
        );
        return { ...generated, ...sent };
      },
      { stats, addError, ...(env().REMINDER_LOCAL_WINDOW ? { filter: inLocalWindow(clock) } : {}) },
    );
  });
}

/** Purge LGPD e retenção (semanal). */
export function runPurgeJob({ db, clock }: JobDeps): Promise<JobRunResult> {
  return runJob(db, "PURGE", async ({ stats }) => {
    Object.assign(stats, await purgeAndRetention(db, clock.now()));
  });
}
