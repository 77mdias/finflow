import { addDays, daysBetween, type DateOnly } from "@/shared/domain/date-only";
import { formatMoney } from "@/shared/domain/money";

export type ReminderType = "INVOICE_DUE" | "INVOICE_OVERDUE" | "SUBSCRIPTION_CHARGE" | "TRIAL_ENDING";

export interface ReminderPreferences {
  invoiceDueEnabled: boolean;
  invoiceDueDaysBefore: number;
  /** null = desativado */
  subscriptionDaysBefore: number | null;
  subscriptionMinCents: bigint;
  trialReminders: boolean;
  overdueAlerts: boolean;
}

export interface ReminderInvoice {
  id: string;
  cardId: string;
  cardNickname: string;
  referenceMonth: string;
  status: "OPEN" | "CLOSED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
  dueDate: DateOnly;
  balanceCents: bigint;
}

/** Página da fatura (`/cards/[id]/invoices/[YYYY-MM]`), usada no app e nos e-mails. */
const invoiceHref = (inv: Pick<ReminderInvoice, "cardId" | "referenceMonth">) =>
  `/cards/${inv.cardId}/invoices/${inv.referenceMonth}`;

export interface ReminderSubscription {
  id: string;
  name: string;
  status: "TRIAL" | "ACTIVE" | "PAUSED" | "CANCELED";
  nextChargeDate: DateOnly;
  amountCents: bigint;
  trialEndsOn: DateOnly | null;
  canceledOn: DateOnly | null;
  cardNickname: string;
}

export interface ReminderCandidate {
  type: ReminderType;
  entityId: string;
  /** Data do evento lembrado — compõe a chave de idempotência (RN-17). */
  targetDate: DateOnly;
  title: string;
  body: string;
  href: string;
}

const days = (n: number) => (n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`);
const ago = (n: number) => (n === 1 ? "ontem" : `há ${n} dias`);

/**
 * Lembrete de um dia em que o job não rodou ainda sai até 2 dias depois (RNF-21), com o prazo
 * real no texto. A chave de idempotência (RN-17) não muda, então quem já recebeu não recebe de novo.
 */
export const MAX_LATE_DAYS = 2;
const sendable = (scheduled: DateOnly, today: DateOnly) => {
  const late = daysBetween(scheduled, today);
  return late >= 0 && late <= MAX_LATE_DAYS;
};

/** RF-060 a RF-063: lembretes devidos hoje (ou atrasados até 2 dias) para um usuário. Função pura. */
export function dueReminders(input: {
  today: DateOnly;
  prefs: ReminderPreferences;
  invoices: readonly ReminderInvoice[];
  subscriptions: readonly ReminderSubscription[];
}): ReminderCandidate[] {
  const { today, prefs } = input;
  const out: ReminderCandidate[] = [];

  if (prefs.invoiceDueEnabled) {
    for (const inv of input.invoices) {
      if (inv.balanceCents <= 0n || !["OPEN", "CLOSED", "PARTIALLY_PAID"].includes(inv.status)) continue;
      const left = daysBetween(today, inv.dueDate);
      if (left < 0 || !sendable(addDays(inv.dueDate, -prefs.invoiceDueDaysBefore), today)) continue;
      out.push({
        type: "INVOICE_DUE",
        entityId: inv.id,
        targetDate: inv.dueDate,
        title: `Fatura do ${inv.cardNickname} vence ${days(left)} — ${formatMoney(inv.balanceCents)}`,
        body: `A fatura de ${inv.referenceMonth} do cartão ${inv.cardNickname} vence em ${inv.dueDate}.`,
        href: invoiceHref(inv),
      });
    }
  }

  if (prefs.overdueAlerts) {
    for (const inv of input.invoices) {
      if (inv.status !== "OVERDUE" || inv.balanceCents <= 0n) continue;
      if (!sendable(addDays(inv.dueDate, 1), today)) continue;
      out.push({
        type: "INVOICE_OVERDUE",
        entityId: inv.id,
        targetDate: inv.dueDate,
        title: `Fatura do ${inv.cardNickname} venceu ${ago(daysBetween(inv.dueDate, today))}`,
        body: `Saldo em aberto: ${formatMoney(inv.balanceCents)}.`,
        href: invoiceHref(inv),
      });
    }
  }

  if (prefs.subscriptionDaysBefore !== null) {
    for (const s of input.subscriptions) {
      const charge = s.nextChargeDate;
      const live =
        s.status === "ACTIVE" || (s.status === "CANCELED" && !!s.canceledOn && charge < s.canceledOn);
      if (!live || s.amountCents < prefs.subscriptionMinCents) continue;
      const left = daysBetween(today, charge);
      if (left < 0 || !sendable(addDays(charge, -prefs.subscriptionDaysBefore), today)) continue;
      out.push({
        type: "SUBSCRIPTION_CHARGE",
        entityId: s.id,
        targetDate: charge,
        title: `${s.name} será cobrada ${days(left)} — ${formatMoney(s.amountCents)}`,
        body: `Cobrança no cartão ${s.cardNickname}.`,
        href: `/subscriptions/${s.id}`,
      });
    }
  }

  if (prefs.trialReminders) {
    for (const s of input.subscriptions) {
      if (s.status !== "TRIAL" || !s.trialEndsOn) continue;
      const left = daysBetween(today, s.trialEndsOn);
      // O aviso mais recente que ainda vale (3 ou 1 dia antes): um por dia, mesmo atrasado.
      const before = left < 0 ? undefined : [1, 3].find((b) => sendable(addDays(s.trialEndsOn!, -b), today));
      if (before === undefined) continue;
      out.push({
        type: "TRIAL_ENDING",
        entityId: s.id,
        // A chave inclui a antecedência para permitir os dois avisos (3 e 1 dia).
        targetDate: addDays(s.trialEndsOn, -before),
        title: `Seu teste de ${s.name} acaba ${days(left)}`,
        body: `Depois disso, a cobrança será de ${formatMoney(s.amountCents)} no cartão ${s.cardNickname}.`,
        href: `/subscriptions/${s.id}`,
      });
    }
  }

  return out;
}
