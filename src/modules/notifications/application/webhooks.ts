import { Webhook } from "svix";
import { z } from "zod";

import { AppError } from "@/shared/domain/errors";
import type { Db } from "@/shared/infrastructure/db";
import { isUniqueViolation } from "@/shared/infrastructure/db";
import { logger } from "@/shared/infrastructure/logger";

const ResendEvent = z.object({
  type: z.string(),
  created_at: z.string().optional(),
  data: z
    .object({
      email_id: z.string().optional(),
      to: z.array(z.string()).optional(),
      bounce: z.object({ type: z.string().optional() }).loose().optional(),
    })
    .loose(),
});

export type ResendEvent = z.infer<typeof ResendEvent>;

/** Verifica a assinatura Svix (timestamp ±5 min) e devolve o evento. */
export function verifyResendWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string | undefined,
): ResendEvent {
  if (!secret) throw new AppError("UNAUTHENTICATED", "Webhook não configurado.");
  if (!headers.id || !headers.timestamp || !headers.signature)
    throw new AppError("UNAUTHENTICATED", "Assinatura ausente.");
  try {
    // svix v2: `verify` só valida (lança se inválido) e não devolve o payload.
    new Webhook(secret).verify(rawBody, {
      "svix-id": headers.id,
      "svix-timestamp": headers.timestamp,
      "svix-signature": headers.signature,
    });
  } catch {
    throw new AppError("UNAUTHENTICATED", "Assinatura inválida.");
  }
  try {
    return ResendEvent.parse(JSON.parse(rawBody));
  } catch {
    throw AppError.validation("Evento inválido.");
  }
}

/**
 * Processa eventos do Resend de forma idempotente (webhook_events).
 * Bounce permanente ou reclamação de spam ⇒ suprime novos e-mails para o usuário.
 */
export async function handleResendEvent(
  db: Db,
  eventId: string,
  event: ResendEvent,
): Promise<{ duplicate: boolean }> {
  try {
    await db.webhookEvent.create({
      data: { id: eventId, provider: "resend", type: event.type.slice(0, 64) },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { duplicate: true };
    throw e;
  }
  const hardBounce =
    event.type === "email.bounced" && (event.data.bounce?.type ?? "Permanent") === "Permanent";
  if (hardBounce || event.type === "email.complained") {
    const emails = (event.data.to ?? []).map((e) => e.toLowerCase());
    if (emails.length) {
      const { count } = await db.user.updateMany({
        where: { email: { in: emails, mode: "insensitive" }, emailSuppressedAt: null },
        data: { emailSuppressedAt: new Date() },
      });
      logger.warn({ type: event.type, suppressed: count }, "e-mail suprimido por webhook");
    }
  }
  return { duplicate: false };
}
