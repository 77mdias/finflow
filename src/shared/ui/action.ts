import "server-only";

import { randomUUID } from "node:crypto";

import { updateTag } from "next/cache";
import { z } from "zod";

import { requireUser, type SessionUser } from "@/lib/session";
import type { UseCaseContext } from "@/shared/application/context";
import { AppError, isAppError, type ErrorCode } from "@/shared/domain/errors";
import { systemClock, type Clock } from "@/shared/infrastructure/clock";
import { transaction } from "@/shared/infrastructure/db";
import { logger } from "@/shared/infrastructure/logger";
import { rateLimiter } from "@/shared/infrastructure/rate-limit";

/** Envelope de resultado das Server Actions (API_SPEC §2.1). */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]>; requestId: string };
    };

/** Áreas de cache por usuário (SOFTWARE_ARCHITECTURE §6.4). */
export type CacheArea =
  | "cards"
  | "invoices"
  | "subscriptions"
  | "expenses"
  | "dashboard"
  | "notifications"
  | "categories"
  | "profile";
export const userTag = (userId: string, area: CacheArea) => `user:${userId}:${area}`;

let clock: Clock = systemClock;
/** Apenas para testes. */
export const setActionClock = (c: Clock | undefined) => {
  clock = c ?? systemClock;
};

/** Converte bigint → number para que o resultado seja serializável pelo React. */
const serializable = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? Number(v) : v))) as T;

export function toActionError(e: unknown, requestId: string, action: string): ActionResult<never> {
  if (e instanceof z.ZodError) {
    const flat = z.flattenError(e);
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Revise os campos destacados.",
        fieldErrors: flat.fieldErrors as Record<string, string[]>,
        requestId,
      },
    };
  }
  if (isAppError(e)) {
    return {
      ok: false,
      error: {
        code: e.code,
        message: e.message,
        ...(e.details?.fieldErrors ? { fieldErrors: e.details.fieldErrors } : {}),
        requestId,
      },
    };
  }
  logger.error({ err: e, requestId, action }, "erro inesperado em Server Action");
  return { ok: false, error: { code: "INTERNAL", message: "Algo deu errado. Tente novamente.", requestId } };
}

/**
 * Fábrica de Server Actions (SOFTWARE_ARCHITECTURE §5.2):
 * autenticação → rate limit → validação Zod → caso de uso em transação → updateTag → ActionResult.
 */
export function action<S extends z.ZodType, R>(opts: {
  name: string;
  schema: S;
  revalidate?: CacheArea[];
  allowDeleted?: boolean;
  handler: (ctx: UseCaseContext, input: z.output<S>, user: SessionUser) => Promise<R>;
  /** Efeito após o commit (ex.: enviar e-mail). Falhas são registradas, não revertem a ação. */
  afterCommit?: (result: R, user: SessionUser) => Promise<void>;
}): (raw: z.input<S>) => Promise<ActionResult<R>> {
  return async (raw) => {
    const requestId = randomUUID();
    try {
      const user = await requireUser({ allowDeleted: opts.allowDeleted });
      const limited = await rateLimiter().check("actions", user.id);
      if (!limited.allowed) {
        throw new AppError(
          "RATE_LIMITED",
          `Muitas tentativas. Tente novamente em ${limited.retryAfterSeconds} s.`,
        );
      }
      const input = opts.schema.parse(raw);
      const result = await transaction((tx) =>
        opts.handler(
          { tx, user: { id: user.id, timezone: user.timezone, plan: user.plan }, clock },
          input,
          user,
        ),
      );
      for (const area of opts.revalidate ?? []) updateTag(userTag(user.id, area));
      if (opts.afterCommit) {
        await opts
          .afterCommit(result, user)
          .catch((e) => logger.error({ err: e, requestId, action: opts.name }, "afterCommit falhou"));
      }
      return { ok: true, data: serializable(result) };
    } catch (e) {
      return toActionError(e, requestId, opts.name);
    }
  };
}
