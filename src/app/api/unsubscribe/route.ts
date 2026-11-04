import { createHash } from "node:crypto";

import { AppError } from "@/shared/domain/errors";
import { prisma } from "@/shared/infrastructure/db";
import { rateLimiter } from "@/shared/infrastructure/rate-limit";
import { clientIp, jsonResponse, route } from "@/shared/ui/http";

import { applyUnsubscribe } from "@/modules/notifications";

export const dynamic = "force-dynamic";

/** Descadastro one-click — RFC 8058 (openapi: unsubscribe). */
export const POST = route(async (req, requestId) => {
  const ipKey = createHash("sha256").update(clientIp(req)).digest("hex");
  const limit = await rateLimiter().check("unsubscribe", ipKey);
  if (!limit.allowed)
    throw new AppError("RATE_LIMITED", "Muitas tentativas.", { retryAfter: limit.retryAfterSeconds });
  const token = new URL(req.url).searchParams.get("token");
  if (!token || token.length > 512) throw AppError.validation("Link de descadastro inválido.");
  const type = await applyUnsubscribe(prisma(), token);
  return jsonResponse({ unsubscribed: type }, requestId);
});
