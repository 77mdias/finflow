import { env } from "@/shared/config/env";
import { prisma } from "@/shared/infrastructure/db";
import { jsonResponse, route } from "@/shared/ui/http";

import { handleResendEvent, verifyResendWebhook } from "@/modules/notifications";

export const dynamic = "force-dynamic";

/** Eventos de e-mail do Resend assinados via Svix (openapi: receiveResendWebhook). */
export const POST = route(async (req, requestId) => {
  const raw = await req.text();
  const headers = {
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
  };
  const event = verifyResendWebhook(raw, headers, env().RESEND_WEBHOOK_SECRET);
  await handleResendEvent(prisma(), headers.id!, event);
  return jsonResponse({ received: true }, requestId);
});
