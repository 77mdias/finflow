import { z } from "zod";

import type { Notification, NotificationPreference } from "@/generated/prisma/client";
import type { QueryContext, UseCaseContext } from "@/shared/application/context";
import { day, iso, isoOrNull, n } from "@/shared/application/dto";
import { Id, NonNegativeMoneyInput } from "@/shared/application/schemas";
import { AppError } from "@/shared/domain/errors";

export const NotificationIdSchema = z.object({ id: Id });

export const UpdatePreferencesSchema = z
  .object({
    emailEnabled: z.boolean(),
    inAppEnabled: z.boolean(),
    invoiceDueEnabled: z.boolean(),
    invoiceDueDaysBefore: z.int().min(0).max(10),
    subscriptionDaysBefore: z.int().min(0).max(10).nullable(),
    subscriptionMin: NonNegativeMoneyInput,
    trialReminders: z.boolean(),
    overdueAlerts: z.boolean(),
    dailyDigest: z.boolean(),
  })
  .partial();

export interface NotificationDTO {
  id: string;
  type: Notification["type"];
  title: string;
  body: string | null;
  targetDate: string;
  createdAt: string;
  readAt: string | null;
  href: string | null;
}

export interface NotificationPreferencesDTO {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  invoiceDueEnabled: boolean;
  invoiceDueDaysBefore: number;
  subscriptionDaysBefore: number | null;
  subscriptionMinCents: number;
  trialReminders: boolean;
  overdueAlerts: boolean;
  dailyDigest: boolean;
}

const toDTO = (x: Notification): NotificationDTO => ({
  id: x.id,
  type: x.type,
  title: x.title,
  body: x.body,
  targetDate: day(x.targetDate),
  createdAt: iso(x.createdAt),
  readAt: isoOrNull(x.readAt),
  href:
    x.payload && typeof x.payload === "object" && "href" in x.payload
      ? String((x.payload as { href: unknown }).href)
      : null,
});

const toPrefsDTO = (p: NotificationPreference): NotificationPreferencesDTO => ({
  emailEnabled: p.emailEnabled,
  inAppEnabled: p.inAppEnabled,
  invoiceDueEnabled: p.invoiceDueEnabled,
  invoiceDueDaysBefore: p.invoiceDueDaysBefore,
  subscriptionDaysBefore: p.subscriptionDaysBefore,
  subscriptionMinCents: n(p.subscriptionMinCents),
  trialReminders: p.trialReminders,
  overdueAlerts: p.overdueAlerts,
  dailyDigest: p.dailyDigest,
});

/** Central in-app (RF-065), paginada por cursor. */
export async function listNotifications(ctx: QueryContext, opts: { cursor?: string; limit?: number } = {}) {
  const take = Math.min(opts.limit ?? 20, 100);
  const rows = await ctx.db.notification.findMany({
    where: { userId: ctx.user.id, channel: "IN_APP" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  return {
    items: rows.slice(0, take).map(toDTO),
    nextCursor: rows.length > take ? rows[take - 1]!.id : null,
  };
}

export async function unreadCount(ctx: QueryContext): Promise<number> {
  return ctx.db.notification.count({ where: { userId: ctx.user.id, channel: "IN_APP", readAt: null } });
}

export async function markNotificationRead(ctx: UseCaseContext, input: { id: string }) {
  const { count } = await ctx.tx.notification.updateMany({
    where: { id: input.id, userId: ctx.user.id, channel: "IN_APP" },
    data: { readAt: ctx.clock.now() },
  });
  if (count === 0) throw AppError.notFound("Notificação");
  return {
    unread: await ctx.tx.notification.count({
      where: { userId: ctx.user.id, channel: "IN_APP", readAt: null },
    }),
  };
}

export async function markAllNotificationsRead(ctx: UseCaseContext) {
  await ctx.tx.notification.updateMany({
    where: { userId: ctx.user.id, channel: "IN_APP", readAt: null },
    data: { readAt: ctx.clock.now() },
  });
  return { unread: 0 };
}

export async function getNotificationPreferences(ctx: QueryContext): Promise<NotificationPreferencesDTO> {
  const p = await ctx.db.notificationPreference.upsert({
    where: { userId: ctx.user.id },
    create: { userId: ctx.user.id },
    update: {},
  });
  return toPrefsDTO(p);
}

export async function updateNotificationPreferences(
  ctx: UseCaseContext,
  input: z.infer<typeof UpdatePreferencesSchema>,
) {
  const { subscriptionMin, ...rest } = input;
  const data = {
    ...rest,
    ...(subscriptionMin !== undefined ? { subscriptionMinCents: subscriptionMin } : {}),
  };
  const p = await ctx.tx.notificationPreference.upsert({
    where: { userId: ctx.user.id },
    create: { userId: ctx.user.id, ...data },
    update: data,
  });
  return toPrefsDTO(p);
}
