import { createHash } from "node:crypto";

import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { AppError } from "@/shared/domain/errors";
import { rateLimiter } from "@/shared/infrastructure/rate-limit";
import { clientIp, errorResponse } from "@/shared/ui/http";

export const dynamic = "force-dynamic";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

/** Better Auth + rate limit do magic link por IP e por e-mail (API_SPEC §4). */
export async function POST(req: Request): Promise<Response> {
  if (new URL(req.url).pathname.endsWith("/sign-in/magic-link")) {
    const body = (await req
      .clone()
      .json()
      .catch(() => ({}))) as { email?: unknown };
    const keys = [
      `ip:${hash(clientIp(req))}`,
      ...(typeof body.email === "string" ? [`email:${hash(body.email.toLowerCase())}`] : []),
    ];
    for (const key of keys) {
      const r = await rateLimiter().check("login", key);
      if (!r.allowed) {
        return errorResponse(
          new AppError("RATE_LIMITED", "Muitas tentativas. Tente novamente em 1 minuto."),
          crypto.randomUUID(),
          {
            "Retry-After": String(r.retryAfterSeconds),
          },
        );
      }
    }
  }
  return toNextJsHandler(auth()).POST(req);
}

export async function GET(req: Request): Promise<Response> {
  return toNextJsHandler(auth()).GET(req);
}
