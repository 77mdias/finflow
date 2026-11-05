import "server-only";

import { randomUUID } from "node:crypto";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { oAuthProxy } from "better-auth/plugins/oauth-proxy";

import { env } from "@/shared/config/env";
import { prisma, transaction } from "@/shared/infrastructure/db";
import { logger, maskEmail } from "@/shared/infrastructure/logger";
import { mailer } from "@/shared/infrastructure/mailer";

import { onUserCreated } from "@/modules/accounts";
import { magicLinkEmail } from "@/modules/notifications";

const DAY = 60 * 60 * 24;

/** O login com Google só existe (e só aparece nas telas) quando o OAuth está configurado. */
export function googleEnabled(): boolean {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}

function createAuth() {
  const e = env();
  const google =
    e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: e.GOOGLE_CLIENT_ID,
            clientSecret: e.GOOGLE_CLIENT_SECRET,
            prompt: "select_account" as const,
          },
        }
      : {};

  return betterAuth({
    appName: "FinFlow",
    baseURL: e.NEXT_PUBLIC_APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma(), { provider: "postgresql" }),
    advanced: {
      // Colunas de id são UUID no Postgres.
      database: { generateId: () => randomUUID() },
    },
    socialProviders: google,
    account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
    session: {
      expiresIn: 30 * DAY, // RF-008
      updateAge: DAY,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // Política única de rate limit via Upstash (API_SPEC §4).
    rateLimit: { enabled: false },
    plugins: [
      magicLink({
        expiresIn: 15 * 60, // RF-001
        sendMagicLink: async ({ email, url }) => {
          await mailer().send(magicLinkEmail({ to: email, url }));
          logger.info({ to: maskEmail(email) }, "magic link enviado");
        },
      }),
      ...(e.OAUTH_PROXY_PRODUCTION_URL ? [oAuthProxy({ productionURL: e.OAUTH_PROXY_PRODUCTION_URL })] : []),
      nextCookies(),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await transaction((tx) => onUserCreated(tx, user.id));
          },
        },
      },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;

/** Instância preguiçosa (o `next build` não tem segredos de runtime). */
export function auth(): Auth {
  instance ??= createAuth();
  return instance;
}
