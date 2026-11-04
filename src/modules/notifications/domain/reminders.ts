import { addDays, type DateOnly } from "@/shared/domain/date-only";
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
  cardNickname: string;
  referenceMonth: string;
  status: "OPEN" | "CLOSED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
  dueDate: DateOnly;
  balanceCents: bigint;
}

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

/** RF-060 a RF-063: lembretes devidos hoje para um usuário. Função pura. */
export function dueReminders(input: {
  today: DateOnly;
  prefs: ReminderPreferences;
  invoices: readonly ReminderInvoice[];
  subscriptions: readonly ReminderSubscription[];
}): ReminderCandidate[] {
  const { today, prefs } = input;
  const out: ReminderCandidate[] = [];

  if (prefs.invoiceDueEnabled) {
    const target = addDays(today, prefs.invoiceDueDaysBefore);
    for (const inv of input.invoices) {
      if (inv.dueDate !== target || inv.balanceCents <= 0n) continue;
      if (!["OPEN", "CLOSED", "PARTIALLY_PAID"].includes(inv.status)) continue;
      out.push({
        type: "INVOICE_DUE",
        entityId: inv.id,
        targetDate: inv.dueDate,
        title: `Fatura do ${inv.cardNickname} vence ${days(prefs.invoiceDueDaysBefore)} — ${formatMoney(inv.balanceCents)}`,
        body: `A fatura de ${inv.referenceMonth} do cartão ${inv.cardNickname} vence em ${inv.dueDate}.`,
        href: `/invoices/${inv.id}`,
      });
    }
  }

  if (prefs.overdueAlerts) {
    const yesterday = addDays(today, -1);
    for (const inv of input.invoices) {
      if (inv.status !== "OVERDUE" || inv.dueDate !== yesterday || inv.balanceCents <= 0n) continue;
      out.push({
        type: "INVOICE_OVERDUE",
        entityId: inv.id,
        targetDate: inv.dueDate,
        title: `Fatura do ${inv.cardNickname} venceu ontem`,
        body: `Saldo em aberto: ${formatMoney(inv.balanceCents)}.`,
        href: `/invoices/${inv.id}`,
      });
    }
  }

  if (prefs.subscriptionDaysBefore !== null) {
    const target = addDays(today, prefs.subscriptionDaysBefore);
    for (const s of input.subscriptions) {
      const live =
        s.status === "ACTIVE" || (s.status === "CANCELED" && !!s.canceledOn && target < s.canceledOn);
      if (!live || s.nextChargeDate !== target || s.amountCents < prefs.subscriptionMinCents) continue;
      out.push({
        type: "SUBSCRIPTION_CHARGE",
        entityId: s.id,
        targetDate: target,
        title: `${s.name} será cobrada ${days(prefs.subscriptionDaysBefore)} — ${formatMoney(s.amountCents)}`,
        body: `Cobrança no cartão ${s.cardNickname}.`,
        href: `/subscriptions/${s.id}`,
      });
    }
  }

  if (prefs.trialReminders) {
    for (const s of input.subscriptions) {
      if (s.status !== "TRIAL" || !s.trialEndsOn) continue;
      for (const before of [3, 1]) {
        if (addDays(today, before) !== s.trialEndsOn) continue;
        out.push({
          type: "TRIAL_ENDING",
          entityId: s.id,
          // A chave inclui a antecedência para permitir os dois avisos (3 e 1 dia).
          targetDate: addDays(s.trialEndsOn, -before),
          title: `Seu teste de ${s.name} acaba ${days(before)}`,
          body: `Depois disso, a cobrança será de ${formatMoney(s.amountCents)} no cartão ${s.cardNickname}.`,
          href: `/subscriptions/${s.id}`,
        });
      }
    }
  }

  return out;
}
