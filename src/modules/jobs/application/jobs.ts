import { env } from "@/shared/config/env";
import type { Clock } from "@/shared/infrastructure/clock";
import type { PrismaClient } from "@/generated/prisma/client";
import { transaction } from "@/shared/infrastructure/db";
import type { Mailer } from "@/shared/infrastructure/mailer";

import { deleteExpiredAuthRecords, purgeAndRetention } from "@/modules/accounts";
import { ensureCurrentInvoices, reconcileInvoiceTotals, updateInvoiceStatuses } from "@/modules/invoices";
import { generateReminders, sendPendingEmails } from "@/modules/notifications";
import { materializeDueSubscriptions } from "@/modules/subscriptions";

import {
  forEachUser,
  forEachUserBatch,
  inLocalWindow,
  mergeStats,
  runJob,
  type JobRunResult,
} from "./runner";

export interface JobDeps {
  db: PrismaClient;
  clock: Clock;
  mailer: Mailer;
}

/**
 * Job diário (ARCHITECTURE §7): por usuário, em uma transação — materializa assinaturas
 * (inclui conversão de testes), fecha/vence faturas, garante a fatura corrente e reconcilia
 * caches. Idempotente; retoma do cursor se a execução anterior caiu.
 */
export function runDailyJob({ db, clock }: JobDeps): Promise<JobRunResult> {
  return runJob(db, "DAILY", async ({ stats, addError, resumeAfter, checkpoint }) => {
    await forEachUserBatch(
      db,
      clock,
      (users) =>
        forEachUser(
          users,
          (u) =>
            transaction(async (tx) => {
              const one = [{ id: u.id, today: u.today }];
              const a = await materializeDueSubscriptions(tx, one);
              const b = await updateInvoiceStatuses(tx, one);
              const c = await ensureCurrentInvoices(tx, one);
              const d = await reconcileInvoiceTotals(tx, [u.id]);
              return { ...a, ...b, ...c, ...d };
            }, db),
          addError,
        ),
      { stats, addError, resumeAfter, checkpoint },
    );
    Object.assign(stats, await deleteExpiredAuthRecords(db, clock.now()));
  });
}

/** Job de lembretes (RF-060..RF-067): gera notificações (por usuário) e envia e-mails pendentes. */
export function runRemindersJob({ db, clock, mailer }: JobDeps): Promise<JobRunResult> {
  return runJob(db, "REMINDERS", async ({ stats, addError, resumeAfter, checkpoint }) => {
    await forEachUserBatch(
      db,
      clock,
      async (users) => {
        const generated = await forEachUser(
          users,
          (u) => transaction((tx) => generateReminders(tx, [{ id: u.id, today: u.today }]), db),
          addError,
        );
        const sent = await sendPendingEmails(
          db,
          mailer,
          users.map((u) => u.id),
        );
        mergeStats(generated, sent);
        return generated;
      },
      {
        stats,
        addError,
        resumeAfter,
        checkpoint,
        ...(env().REMINDER_LOCAL_WINDOW ? { filter: inLocalWindow(clock) } : {}),
      },
    );
  });
}

/** Purge LGPD e retenção (semanal). */
export function runPurgeJob({ db, clock }: JobDeps): Promise<JobRunResult> {
  return runJob(db, "PURGE", async ({ stats }) => {
    Object.assign(stats, await purgeAndRetention(db, clock.now()));
  });
}
