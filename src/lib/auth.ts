import "server-only";

import { randomUUID } from "node:crypto";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { oAuthProxy } from "better-auth/plugins/oauth-proxy";

import { env, type Env } from "@/shared/config/env";
import { prisma, transaction } from "@/shared/infrastructure/db";
import { logger, maskEmail } from "@/shared/infrastructure/logger";
import { mailer } from "@/shared/infrastructure/mailer";

import { onUserCreated } from "@/modules/accounts";
import { magicLinkEmail } from "@/modules/notifications";

const DAY = 60 * 60 * 24;

export type OAuthProvider = "google" | "discord";

/**
 * O Discord pode devolver um e-mail que a pessoa não confirmou. Sem e-mail, o Better Auth recusa o
 * login (`email_not_found`) antes de criar ou vincular conta. Isso impede que alguém crie a conta com
 * o e-mail de outra pessoa e continue com acesso depois que a dona entrar pelo link.
 */
export function discordProfileToUser(profile: { verified: boolean }): { email?: undefined } {
  return profile.verified ? {} : { email: undefined };
}

/** Login social: cada provedor só existe (e só aparece nas telas) com as credenciais no ambiente. */
function socialProviders(e: Env) {
  return {
    ...(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: e.GOOGLE_CLIENT_ID,
            clientSecret: e.GOOGLE_CLIENT_SECRET,
            prompt: "select_account" as const,
          },
        }
      : {}),
    ...(e.DISCORD_CLIENT_ID && e.DISCORD_CLIENT_SECRET
      ? {
          discord: {
            clientId: e.DISCORD_CLIENT_ID,
            clientSecret: e.DISCORD_CLIENT_SECRET,
            mapProfileToUser: discordProfileToUser,
          },
        }
      : {}),
  };
}

/** Provedores configurados, na ordem dos botões. */
export function oauthProviders(): OAuthProvider[] {
  return Object.keys(socialProviders(env())) as OAuthProvider[];
}

function createAuth() {
  const e = env();

  return betterAuth({
    appName: "FinFlow",
    baseURL: e.NEXT_PUBLIC_APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma(), { provider: "postgresql" }),
    advanced: {
      // Colunas de id são UUID no Postgres.
      database: { generateId: () => randomUUID() },
    },
    socialProviders: socialProviders(e),
    // Só o Google vincula a uma conta existente sem checagem: ele sempre verifica o e-mail. O Discord
    // fica de fora e só vincula quando informa o e-mail como verificado (padrão do Better Auth).
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
