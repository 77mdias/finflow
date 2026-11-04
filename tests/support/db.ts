import { afterAll, beforeEach } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import type { QueryContext, UseCaseContext, UserContext } from "@/shared/application/context";
import { resetEnvCache } from "@/shared/config/env";
import { fixedClock, type Clock } from "@/shared/infrastructure/clock";
import { createPrismaClient, setPrismaClient, transaction } from "@/shared/infrastructure/db";
import { MemoryMailer, setMailer } from "@/shared/infrastructure/mailer";
import { MemoryRateLimiter, setRateLimiter } from "@/shared/infrastructure/rate-limit";

import { seedDefaultCategories } from "@/modules/categories";

import { TEST_DATABASE_URL } from "./test-env";

export const db: PrismaClient = createPrismaClient(TEST_DATABASE_URL);
export const mail = new MemoryMailer();

setPrismaClient(db);
setMailer(mail);
setRateLimiter(new MemoryRateLimiter());
resetEnvCache();

const TABLES = [
  "payments",
  "charges",
  "invoices",
  "subscription_price_history",
  "subscriptions",
  "expenses",
  "cards",
  "categories",
  "notifications",
  "notification_preferences",
  "consents",
  "sessions",
  "accounts",
  "verifications",
  "job_runs",
  "webhook_events",
  "users",
];

/** Limpa o banco e a caixa de e-mails antes de cada teste. */
export function resetDatabaseBeforeEach() {
  beforeEach(async () => {
    await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
    mail.sent.length = 0;
    mail.failNext = 0;
  });
  afterAll(async () => {
    await db.$disconnect();
  });
}

let seq = 0;

export async function makeUser(
  over: { timezone?: string; email?: string } = {},
): Promise<UserContext & { email: string }> {
  seq++;
  const user = await db.user.create({
    data: {
      email: over.email ?? `user${seq}-${Date.now()}@teste.local`,
      name: `Usuário ${seq}`,
      timezone: over.timezone ?? "America/Sao_Paulo",
      notificationPreference: { create: {} },
    },
  });
  await transaction((tx) => seedDefaultCategories(tx, user.id), db);
  return { id: user.id, timezone: user.timezone, plan: user.plan, email: user.email };
}

/** Executa um caso de uso em transação, como faria uma Server Action. */
export function run<T>(
  user: UserContext,
  clock: Clock | string,
  fn: (ctx: UseCaseContext) => Promise<T>,
): Promise<T> {
  const c = typeof clock === "string" ? fixedClock(clock) : clock;
  return transaction((tx) => fn({ tx, user, clock: c }), db);
}

export function queryCtx(user: UserContext, clock: Clock | string): QueryContext {
  return { db, user, clock: typeof clock === "string" ? fixedClock(clock) : clock };
}

/** 12:00 em São Paulo do dia informado. */
export const at = (date: string) => `${date}T15:00:00.000Z`;
