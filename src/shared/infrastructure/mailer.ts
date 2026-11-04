import nodemailer from "nodemailer";
import { Resend } from "resend";

import { env } from "@/shared/config/env";

import { logger, maskEmail } from "./logger";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Evita duplicidade em retentativas (Resend `Idempotency-Key`). */
  idempotencyKey?: string;
  headers?: Record<string, string>;
}

/** Porta de envio de e-mail (docs/INTEGRATIONS.md §3.1). */
export interface Mailer {
  send(email: OutgoingEmail): Promise<{ providerMessageId: string }>;
}

class ResendMailer implements Mailer {
  private readonly client: Resend;
  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }
  async send(email: OutgoingEmail) {
    const { data, error } = await this.client.emails.send(
      {
        from: this.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: email.headers,
      },
      email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : undefined,
    );
    if (error || !data)
      throw new Error(`Resend: ${error?.name ?? "erro"} — ${error?.message ?? "sem resposta"}`);
    return { providerMessageId: data.id };
  }
}

class SmtpMailer implements Mailer {
  private readonly transport: ReturnType<typeof nodemailer.createTransport>;
  constructor(
    url: string,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport(url);
  }
  async send(email: OutgoingEmail) {
    const info = await this.transport.sendMail({
      from: this.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.headers,
    });
    return { providerMessageId: info.messageId };
  }
}

/** Guarda os e-mails em memória (testes). */
export class MemoryMailer implements Mailer {
  readonly sent: (OutgoingEmail & { providerMessageId: string })[] = [];
  failNext = 0;
  async send(email: OutgoingEmail) {
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error("falha simulada");
    }
    const providerMessageId = `mem-${this.sent.length + 1}`;
    this.sent.push({ ...email, providerMessageId });
    return { providerMessageId };
  }
}

let instance: Mailer | undefined;

export function mailer(): Mailer {
  if (instance) return instance;
  const e = env();
  instance =
    e.EMAIL_TRANSPORT === "resend"
      ? new ResendMailer(e.RESEND_API_KEY!, e.EMAIL_FROM)
      : e.EMAIL_TRANSPORT === "smtp"
        ? new SmtpMailer(e.SMTP_URL, e.EMAIL_FROM)
        : new MemoryMailer();
  logger.info({ transport: e.EMAIL_TRANSPORT }, "mailer inicializado");
  return instance;
}

/** Apenas para testes. */
export function setMailer(m: Mailer | undefined): void {
  instance = m;
}

export const describeRecipient = maskEmail;
