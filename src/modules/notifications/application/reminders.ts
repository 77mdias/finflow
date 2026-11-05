import { createHash } from "node:crypto";

import type { Notification } from "@/generated/prisma/client";
import { env } from "@/shared/config/env";
import { addDays, fromDbDate, toDbDate, type DateOnly } from "@/shared/domain/date-only";
import type { Db, Tx } from "@/shared/infrastructure/db";
import { logger } from "@/shared/infrastructure/logger";
import type { Mailer } from "@/shared/infrastructure/mailer";

import { dueReminders } from "../domain/reminders";
import { digestEmail, reminderEmail, type ReminderItem } from "./templates";
import { unsubscribeUrl } from "./unsubscribe";

/** Total de tentativas de envio (1 + 3 reenvios — RN-17). */
export const MAX_EMAIL_ATTEMPTS = 4;

/** Gera os lembretes do dia (IN_APP + EMAIL) de forma idempotente (RN-17). */
export async function generateReminders(tx: Tx, users: ReadonlyArray<{ id: string; today: DateOnly }>) {
  let created = 0;
  for (const { id: userId, today } of users) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { notificationPreference: true },
    });
    if (!user || user.deletedAt) continue;
    const prefs =
      user.notificationPreference ?? (await tx.notificationPreference.create({ data: { userId } }));
    const horizon = toDbDate(addDays(today, 10));
    const [invoices, subscriptions] = await Promise.all([
      tx.invoice.findMany({
        where: {
          userId,
          status: { in: ["OPEN", "CLOSED", "PARTIALLY_PAID", "OVERDUE"] },
          dueDate: { gte: toDbDate(addDays(today, -1)), lte: horizon },
        },
        include: { card: { select: { nickname: true } } },
      }),
      tx.subscription.findMany({
        where: {
          userId,
          status: { in: ["ACTIVE", "TRIAL", "CANCELED"] },
          OR: [
            { nextChargeDate: { gte: toDbDate(today), lte: horizon } },
            { trialEndsOn: { gte: toDbDate(today), lte: horizon } },
          ],
        },
        include: { card: { select: { nickname: true } } },
      }),
    ]);
    const candidates = dueReminders({
      today,
      prefs: {
        invoiceDueEnabled: prefs.invoiceDueEnabled,
        invoiceDueDaysBefore: prefs.invoiceDueDaysBefore,
        subscriptionDaysBefore: prefs.subscriptionDaysBefore,
        subscriptionMinCents: prefs.subscriptionMinCents,
        trialReminders: prefs.trialReminders,
        overdueAlerts: prefs.overdueAlerts,
      },
      invoices: invoices.map((i) => ({
        id: i.id,
        cardId: i.cardId,
        cardNickname: i.card.nickname,
        referenceMonth: i.referenceMonth,
        status: i.status,
        dueDate: fromDbDate(i.dueDate),
        balanceCents: i.totalCents - i.paidCents,
      })),
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        nextChargeDate: fromDbDate(s.nextChargeDate),
        amountCents: s.amountCents,
        trialEndsOn: s.trialEndsOn ? fromDbDate(s.trialEndsOn) : null,
        canceledOn: s.canceledOn ? fromDbDate(s.canceledOn) : null,
        cardNickname: s.card.nickname,
      })),
    });
    const now = new Date();
    const rows = candidates.flatMap((c) => {
      const base = {
        userId,
        type: c.type,
        entityId: c.entityId,
        targetDate: toDbDate(c.targetDate),
        title: c.title,
        body: c.body,
        payload: { href: c.href },
      };
      return [
        ...(prefs.inAppEnabled
          ? [{ ...base, channel: "IN_APP" as const, status: "SENT" as const, sentAt: now }]
          : []),
        ...(prefs.emailEnabled && !user.emailSuppressedAt
          ? [{ ...base, channel: "EMAIL" as const, status: "PENDING" as const }]
          : []),
      ];
    });
    if (rows.length)
      created += (await tx.notification.createMany({ data: rows, skipDuplicates: true })).count;
  }
  return { notificationsCreated: created };
}

/** Lembretes de fatura ficam obsoletos se a fatura foi quitada antes do envio. */
async function isStale(db: Db, n: Notification): Promise<boolean> {
  if (n.type !== "INVOICE_DUE" && n.type !== "INVOICE_OVERDUE") return false;
  const inv = await db.invoice.findUnique({
    where: { id: n.entityId },
    select: { totalCents: true, paidCents: true },
  });
  return !inv || inv.totalCents - inv.paidCents <= 0n;
}

const href = (n: Notification) =>
  n.payload && typeof n.payload === "object" && "href" in n.payload
    ? String((n.payload as { href: unknown }).href)
    : null;

/** Envia e-mails PENDING (e reenvia FAILED) dos usuários do lote. Individual ou resumo diário (RF-066). */
export async function sendPendingEmails(db: Db, mailer: Mailer, userIds: readonly string[]) {
  const stats = { emailsSent: 0, emailsFailed: 0, emailsSkipped: 0 };
  if (userIds.length === 0) return stats;
  const appUrl = env().NEXT_PUBLIC_APP_URL;
  const pending = await db.notification.findMany({
    where: {
      userId: { in: [...userIds] },
      channel: "EMAIL",
      OR: [{ status: "PENDING" }, { status: "FAILED", attempts: { lt: MAX_EMAIL_ATTEMPTS } }],
    },
    include: { user: { include: { notificationPreference: true } } },
    orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
  });

  const byUser = new Map<string, typeof pending>();
  for (const n of pending) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n]);

  for (const [userId, items] of byUser) {
    const user = items[0]!.user;
    const prefs = user.notificationPreference;
    const live: typeof items = [];
    for (const n of items) {
      if (user.deletedAt || user.emailSuppressedAt || !prefs?.emailEnabled || (await isStale(db, n))) {
        await db.notification.update({ where: { id: n.id }, data: { status: "SKIPPED" } });
        stats.emailsSkipped++;
      } else live.push(n);
    }
    if (live.length === 0) continue;

    const toItem = (n: Notification): ReminderItem => ({
      type: n.type,
      title: n.title,
      body: n.body,
      href: href(n),
    });
    const batches =
      prefs?.dailyDigest && live.length > 1
        ? [
            {
              ids: live.map((n) => n.id),
              email: digestEmail({
                to: user.email,
                appUrl,
                items: live.map(toItem),
                unsubscribe: unsubscribeUrl(userId, "DAILY_DIGEST"),
                idempotencyKey: `digest-${createHash("sha256")
                  .update(
                    live
                      .map((n) => n.id)
                      .sort()
                      .join(","),
                  )
                  .digest("hex")}`,
              }),
            },
          ]
        : live.map((n) => ({
            ids: [n.id],
            email: reminderEmail({
              to: user.email,
              appUrl,
              item: toItem(n),
              unsubscribe: unsubscribeUrl(userId, n.type),
              idempotencyKey: n.id,
            }),
          }));

    for (const b of batches) {
      try {
        const { providerMessageId } = await mailer.send(b.email);
        await db.notification.updateMany({
          where: { id: { in: b.ids } },
          data: {
            status: "SENT",
            sentAt: new Date(),
            providerMessageId,
            attempts: { increment: 1 },
            lastError: null,
          },
        });
        stats.emailsSent += b.ids.length;
      } catch (e) {
        logger.warn({ err: e, userId, count: b.ids.length }, "falha ao enviar lembrete");
        await db.notification.updateMany({
          where: { id: { in: b.ids } },
          data: {
            status: "FAILED",
            attempts: { increment: 1 },
            lastError: String(e instanceof Error ? e.message : e).slice(0, 500),
          },
        });
        stats.emailsFailed += b.ids.length;
      }
    }
  }
  return stats;
}
