import type { NotificationType } from "@/generated/prisma/enums";
import type { OutgoingEmail } from "@/shared/infrastructure/mailer";

/**
 * Templates de e-mail em HTML simples + texto. Serão substituídos por React Email
 * na fase de frontend, mantendo esta mesma interface.
 */
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface ReminderItem {
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
}

function layout(appUrl: string, heading: string, itemsHtml: string, unsubscribe: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f5f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td><p style="margin:0 0 4px;font-weight:700;color:#6d28d9">FinFlow</p><h1 style="margin:0 0 16px;font-size:20px">${escape(heading)}</h1>${itemsHtml}
<p style="margin:24px 0 0"><a href="${escape(appUrl)}/dashboard" style="background:#6d28d9;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block">Abrir o FinFlow</a></p>
</td></tr></table>
<p style="font-size:12px;color:#71717a;margin:16px 0 0">Você recebe este e-mail porque ativou lembretes no FinFlow. <a href="${escape(unsubscribe)}" style="color:#71717a">Não quero mais receber este tipo de aviso</a>.</p>
</td></tr></table></body></html>`;
}

const itemHtml = (appUrl: string, i: ReminderItem) =>
  `<div style="border-left:3px solid #6d28d9;padding:8px 12px;margin:0 0 12px;background:#faf5ff;border-radius:6px">
<p style="margin:0;font-weight:600">${i.href ? `<a href="${escape(appUrl + i.href)}" style="color:#18181b;text-decoration:none">${escape(i.title)}</a>` : escape(i.title)}</p>
${i.body ? `<p style="margin:4px 0 0;color:#52525b">${escape(i.body)}</p>` : ""}</div>`;

const itemText = (appUrl: string, i: ReminderItem) =>
  `• ${i.title}${i.body ? `\n  ${i.body}` : ""}${i.href ? `\n  ${appUrl}${i.href}` : ""}`;

function unsubscribeHeaders(unsubscribe: string): Record<string, string> {
  return { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

export function reminderEmail(args: {
  to: string;
  appUrl: string;
  item: ReminderItem;
  unsubscribe: string;
  idempotencyKey: string;
}): OutgoingEmail {
  return {
    to: args.to,
    subject: args.item.title,
    html: layout(args.appUrl, args.item.title, itemHtml(args.appUrl, args.item), args.unsubscribe),
    text: `${itemText(args.appUrl, args.item)}\n\nAbrir o FinFlow: ${args.appUrl}/dashboard\nDescadastrar: ${args.unsubscribe}`,
    idempotencyKey: args.idempotencyKey,
    headers: unsubscribeHeaders(args.unsubscribe),
  };
}

export function digestEmail(args: {
  to: string;
  appUrl: string;
  items: ReminderItem[];
  unsubscribe: string;
  idempotencyKey: string;
}): OutgoingEmail {
  const count = args.items.length;
  const subject = `Seu resumo de hoje: ${count} ${count === 1 ? "aviso" : "avisos"}`;
  return {
    to: args.to,
    subject,
    html: layout(
      args.appUrl,
      subject,
      args.items.map((i) => itemHtml(args.appUrl, i)).join(""),
      args.unsubscribe,
    ),
    text: `${args.items.map((i) => itemText(args.appUrl, i)).join("\n\n")}\n\nDescadastrar: ${args.unsubscribe}`,
    idempotencyKey: args.idempotencyKey,
    headers: unsubscribeHeaders(args.unsubscribe),
  };
}

export function accountDeletionEmail(args: {
  to: string;
  appUrl: string;
  purgeAfter: string;
}): OutgoingEmail {
  const subject = "Sua conta do FinFlow será excluída em 30 dias";
  const body = `Recebemos seu pedido de exclusão. Seus dados serão apagados definitivamente em ${args.purgeAfter}. Se mudar de ideia, basta entrar novamente até essa data para reativar a conta.`;
  return {
    to: args.to,
    subject,
    html: `<!doctype html><html lang="pt-BR"><body style="font-family:system-ui,sans-serif"><h1 style="font-size:20px">${escape(subject)}</h1><p>${escape(body)}</p><p><a href="${escape(args.appUrl)}/login">Entrar no FinFlow</a></p></body></html>`,
    text: `${body}\n\n${args.appUrl}/login`,
  };
}

export function magicLinkEmail(args: { to: string; url: string }): OutgoingEmail {
  const subject = "Seu link de acesso ao FinFlow";
  return {
    to: args.to,
    subject,
    html: `<!doctype html><html lang="pt-BR"><body style="font-family:system-ui,sans-serif"><h1 style="font-size:20px">${escape(subject)}</h1><p>Clique no botão para entrar. O link vale por 15 minutos e só pode ser usado uma vez.</p><p><a href="${escape(args.url)}" style="background:#6d28d9;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Entrar no FinFlow</a></p><p style="color:#71717a;font-size:12px">Se você não pediu este link, ignore este e-mail.</p></body></html>`,
    text: `Entre no FinFlow (válido por 15 minutos): ${args.url}\n\nSe você não pediu este link, ignore este e-mail.`,
  };
}
