import { z } from "zod";

import type { User } from "@/generated/prisma/client";
import type { QueryContext, UseCaseContext } from "@/shared/application/context";
import { iso, isoOrNull } from "@/shared/application/dto";
import { TimeZoneInput } from "@/shared/application/schemas";
import { addDays, todayIn } from "@/shared/domain/date-only";
import { AppError } from "@/shared/domain/errors";
import type { Db, Tx } from "@/shared/infrastructure/db";

import { seedDefaultCategories } from "@/modules/categories";

/** Versão vigente dos termos e da política de privacidade (registrada no consentimento). */
export const CURRENT_TERMS_VERSION = "2026-11";
export const DELETION_GRACE_DAYS = 30;

export const UpdateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  timezone: TimeZoneInput.optional(),
  locale: z.enum(["pt-BR"]).optional(),
});

export const RequestDeletionSchema = z.object({ confirmEmail: z.email("E-mail inválido") });

export interface ProfileDTO {
  id: string;
  email: string;
  name: string;
  image: string | null;
  timezone: string;
  currency: string;
  locale: string;
  plan: User["plan"];
  onboardingCompleted: boolean;
  deletionRequestedAt: string | null;
  createdAt: string;
}

export const toProfileDTO = (u: User): ProfileDTO => ({
  id: u.id,
  email: u.email,
  name: u.name,
  image: u.image,
  timezone: u.timezone,
  currency: u.currency,
  locale: u.locale,
  plan: u.plan,
  onboardingCompleted: !!u.onboardingCompletedAt,
  deletionRequestedAt: isoOrNull(u.deletedAt),
  createdAt: iso(u.createdAt),
});

/** Executado após o 1º login (hook do Better Auth): preferências, categorias e consentimento. */
export async function onUserCreated(tx: Tx, userId: string, ipHash?: string): Promise<void> {
  await tx.notificationPreference.upsert({ where: { userId }, create: { userId }, update: {} });
  await seedDefaultCategories(tx, userId);
  const existing = await tx.consent.count({ where: { userId, version: CURRENT_TERMS_VERSION } });
  if (existing === 0) {
    await tx.consent.createMany({
      data: (["TERMS", "PRIVACY"] as const).map((type) => ({
        userId,
        type,
        version: CURRENT_TERMS_VERSION,
        ipHash: ipHash ?? null,
      })),
    });
  }
}

export async function getProfile(ctx: QueryContext): Promise<ProfileDTO> {
  const u = await ctx.db.user.findUnique({ where: { id: ctx.user.id } });
  if (!u) throw AppError.notFound("Usuário");
  return toProfileDTO(u);
}

export async function updateProfile(ctx: UseCaseContext, input: z.infer<typeof UpdateProfileSchema>) {
  return toProfileDTO(await ctx.tx.user.update({ where: { id: ctx.user.id }, data: input }));
}

export async function completeOnboarding(ctx: UseCaseContext) {
  await ctx.tx.user.update({ where: { id: ctx.user.id }, data: { onboardingCompletedAt: ctx.clock.now() } });
  return { ok: true as const };
}

/** RF-007: exclusão com carência de 30 dias; encerra todas as sessões. */
export async function requestAccountDeletion(
  ctx: UseCaseContext,
  input: z.infer<typeof RequestDeletionSchema>,
) {
  const u = await ctx.tx.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
  if (u.email.toLowerCase() !== input.confirmEmail.trim().toLowerCase()) {
    throw AppError.validation("O e-mail não confere com o da conta.", {
      confirmEmail: ["E-mail diferente do da conta"],
    });
  }
  const now = ctx.clock.now();
  await ctx.tx.user.update({ where: { id: u.id }, data: { deletedAt: now } });
  await ctx.tx.session.deleteMany({ where: { userId: u.id } });
  return { email: u.email, purgeAfter: addDays(todayIn(u.timezone, now), DELETION_GRACE_DAYS) };
}

export async function reactivateAccount(ctx: UseCaseContext) {
  return toProfileDTO(await ctx.tx.user.update({ where: { id: ctx.user.id }, data: { deletedAt: null } }));
}

/** RF-006: exportação LGPD (API_SPEC §8.3). BigInt → number; sem tokens nem sessões. */
export async function exportUserData(db: Db, userId: string) {
  const u = await db.user.findUnique({
    where: { id: userId },
    include: {
      consents: true,
      cards: true,
      categories: true,
      subscriptions: { include: { priceHistory: true } },
      expenses: true,
      invoices: true,
      charges: true,
      payments: true,
      notificationPreference: true,
      notifications: { where: { channel: "IN_APP" } },
    },
  });
  if (!u) throw AppError.notFound("Usuário");
  const plain = <T>(value: T): unknown =>
    JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
  const {
    consents,
    cards,
    categories,
    subscriptions,
    expenses,
    invoices,
    charges,
    payments,
    notificationPreference,
    notifications,
  } = u;
  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    profile: {
      email: u.email,
      name: u.name,
      timezone: u.timezone,
      currency: u.currency,
      locale: u.locale,
      createdAt: u.createdAt.toISOString(),
    },
    consents: plain(consents.map(({ ipHash: _ip, ...c }) => c)),
    cards: plain(cards),
    categories: plain(categories),
    subscriptions: plain(subscriptions.map(({ priceHistory: _p, ...s }) => s)),
    subscriptionPriceHistory: plain(subscriptions.flatMap((s) => s.priceHistory)),
    expenses: plain(expenses),
    invoices: plain(invoices),
    charges: plain(charges),
    payments: plain(payments),
    notificationPreferences: plain(notificationPreference),
    notifications: plain(notifications),
  };
}

/** Purge LGPD (contas com exclusão há > 30 dias) e retenção (DATABASE §12). */
export async function purgeAndRetention(db: Db, now: Date) {
  const dayMs = 86_400_000;
  const cutoff = new Date(now.getTime() - DELETION_GRACE_DAYS * dayMs);
  const purged = await db.user.deleteMany({ where: { deletedAt: { lt: cutoff } } });
  const notifications = await db.notification.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 180 * dayMs) } },
  });
  const jobRuns = await db.jobRun.deleteMany({
    where: { startedAt: { lt: new Date(now.getTime() - 90 * dayMs) } },
  });
  const webhooks = await db.webhookEvent.deleteMany({
    where: { receivedAt: { lt: new Date(now.getTime() - 90 * dayMs) } },
  });
  return {
    accountsPurged: purged.count,
    notificationsDeleted: notifications.count,
    jobRunsDeleted: jobRuns.count,
    webhookEventsDeleted: webhooks.count,
  };
}

/** Limpeza diária de sessões e tokens de magic link expirados. */
export async function deleteExpiredAuthRecords(db: Db, now: Date) {
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const verifications = await db.verification.deleteMany({ where: { expiresAt: { lt: now } } });
  return { sessionsDeleted: sessions.count, verificationsDeleted: verifications.count };
}
