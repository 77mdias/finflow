import { createHmac, timingSafeEqual } from "node:crypto";

import type { NotificationType } from "@/generated/prisma/enums";
import { env } from "@/shared/config/env";
import { AppError } from "@/shared/domain/errors";
import type { Db } from "@/shared/infrastructure/db";

/** Token de descadastro one-click (API_SPEC §8.2): base64url(payload).base64url(HMAC-SHA256). */
interface Payload {
  uid: string;
  type: NotificationType;
  iat: number;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest();

export function createUnsubscribeToken(
  userId: string,
  type: NotificationType,
  secret = env().UNSUBSCRIBE_SECRET,
): string {
  const payload = b64(
    JSON.stringify({ uid: userId, type, iat: Math.floor(Date.now() / 1000) } satisfies Payload),
  );
  return `${payload}.${b64(sign(payload, secret))}`;
}

export function verifyUnsubscribeToken(token: string, secret = env().UNSUBSCRIBE_SECRET): Payload {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw AppError.validation("Link de descadastro inválido.");
  const expected = sign(payload, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw AppError.validation("Link de descadastro inválido.");
  }
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Payload;
    if (typeof p.uid !== "string" || typeof p.type !== "string") throw new Error("payload");
    return p;
  } catch {
    throw AppError.validation("Link de descadastro inválido.");
  }
}

export function unsubscribeUrl(userId: string, type: NotificationType): string {
  return `${env().NEXT_PUBLIC_APP_URL}/api/unsubscribe?token=${createUnsubscribeToken(userId, type)}`;
}

/** Aplica o descadastro do tipo indicado (idempotente). */
export async function applyUnsubscribe(db: Db, token: string): Promise<NotificationType> {
  const { uid, type } = verifyUnsubscribeToken(token);
  const data =
    type === "INVOICE_DUE"
      ? { invoiceDueEnabled: false }
      : type === "INVOICE_OVERDUE"
        ? { overdueAlerts: false }
        : type === "SUBSCRIPTION_CHARGE"
          ? { subscriptionDaysBefore: null }
          : type === "TRIAL_ENDING"
            ? { trialReminders: false }
            : { emailEnabled: false }; // DAILY_DIGEST: desliga e-mails de lembrete
  await db.notificationPreference.updateMany({ where: { userId: uid }, data });
  return type;
}
