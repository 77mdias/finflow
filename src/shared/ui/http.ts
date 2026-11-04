import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { env } from "@/shared/config/env";
import { AppError, HTTP_STATUS, isAppError } from "@/shared/domain/errors";
import { logger } from "@/shared/infrastructure/logger";

/** Envelope de erro HTTP (API_SPEC §2.2) com `X-Request-Id`. */
export function errorResponse(
  e: unknown,
  requestId: string,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  const err = isAppError(e) ? e : new AppError("INTERNAL", "Algo deu errado. Tente novamente.");
  if (!isAppError(e)) logger.error({ err: e, requestId }, "erro inesperado em rota HTTP");
  return NextResponse.json(
    {
      error: {
        code: err.code,
        message: err.message,
        requestId,
        ...(err.details?.fieldErrors ? { fieldErrors: err.details.fieldErrors } : {}),
      },
    },
    { status: HTTP_STATUS[err.code], headers: { "X-Request-Id": requestId, ...extraHeaders } },
  );
}

export function jsonResponse(
  body: unknown,
  requestId: string,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { "X-Request-Id": requestId, "Cache-Control": "no-store", ...init.headers },
  });
}

/** Executa um handler com requestId e tratamento padronizado de erros. */
export function route(handler: (req: Request, requestId: string) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const requestId = randomUUID();
    try {
      return await handler(req, requestId);
    } catch (e) {
      const retry =
        isAppError(e) && e.code === "RATE_LIMITED" && typeof e.details?.retryAfter === "number"
          ? { "Retry-After": String(e.details.retryAfter) }
          : undefined;
      return errorResponse(e, requestId, retry);
    }
  };
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Autentica chamadas do Vercel Cron (`Authorization: Bearer $CRON_SECRET`). */
export function assertCronAuth(req: Request): void {
  const header = req.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${env().CRON_SECRET}`))
    throw new AppError("UNAUTHENTICATED", "Credencial inválida.");
}

/** IP do cliente (atrás da Vercel), para rate limit — nunca armazenado em claro. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
  );
}
