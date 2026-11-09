import { type QueryContext, todayOf } from "@/shared/application/context";
import { n } from "@/shared/application/dto";
import {
  addDays,
  addYearMonths,
  daysBetween,
  fromDbDate,
  parseYearMonth,
  toDbDate,
  yearMonthOf,
  type DateOnly,
  type YearMonth,
} from "@/shared/domain/date-only";
import { AppError } from "@/shared/domain/errors";

import { listCards } from "@/modules/cards";
import {
  invoiceFor,
  invoiceForReference,
  toChargeDTO,
  toInvoiceSummaryDTO,
  toPaymentDTO,
  type InvoiceSummaryDTO,
} from "@/modules/invoices";
import { recurringMonthlyCents } from "@/modules/subscriptions";

import { projectInvoices, projectSubscription, type ProjectableSubscription } from "../domain/projection";

async function projectable(ctx: QueryContext, cardId?: string): Promise<ProjectableSubscription[]> {
  const subs = await ctx.db.subscription.findMany({
    where: {
      userId: ctx.user.id,
      status: { in: ["ACTIVE", "TRIAL", "CANCELED"] },
      ...(cardId ? { cardId } : {}),
    },
    include: { priceHistory: true },
  });
  return subs.map((s) => ({
    id: s.id,
    name: s.name,
    cardId: s.cardId,
    categoryId: s.categoryId,
    amountCents: s.amountCents,
    priceHistory: s.priceHistory.map((p) => ({
      amountCents: p.amountCents,
      effectiveFrom: fromDbDate(p.effectiveFrom),
    })),
    status: s.status,
    cycle: s.cycle,
    billingAnchorDay: s.billingAnchorDay,
    nextChargeDate: fromDbDate(s.nextChargeDate),
    trialEndsOn: s.trialEndsOn ? fromDbDate(s.trialEndsOn) : null,
    canceledOn: s.canceledOn ? fromDbDate(s.canceledOn) : null,
  }));
}

/** RF-055: projeção de N meses (materializado + previsto) por cartão. */
export async function getProjection(ctx: QueryContext, months = 12) {
  const today = todayOf(ctx);
  const cards = await ctx.db.card.findMany({ where: { userId: ctx.user.id, archivedAt: null } });
  const invoices = await ctx.db.invoice.findMany({
    where: { userId: ctx.user.id, dueDate: { gte: toDbDate(addDays(today, -40)) } },
    select: { cardId: true, referenceMonth: true, totalCents: true },
  });
  const result = projectInvoices({
    today,
    months,
    cards,
    subscriptions: await projectable(ctx),
    materialized: invoices.map((i) => ({ ...i, referenceMonth: parseYearMonth(i.referenceMonth) })),
  });
  return {
    months: result.map((m) => ({
      referenceMonth: m.referenceMonth,
      totalCents: n(m.totalCents),
      byCard: m.byCard.map((c) => ({
        cardId: c.cardId,
        totalCents: n(c.totalCents),
        projectedCents: n(c.projectedCents),
      })),
    })),
  };
}

/** Fatura de um cartão por mês de referência, incluindo cobranças previstas (RF-042, RF-043). */
export async function getInvoiceView(ctx: QueryContext, cardId: string, referenceMonth: string) {
  const ref = parseYearMonth(referenceMonth);
  const card = await ctx.db.card.findFirst({ where: { id: cardId, userId: ctx.user.id } });
  if (!card) throw AppError.notFound("Cartão");
  const period = invoiceForReference(ref, card);
  const inv = await ctx.db.invoice.findUnique({
    where: { cardId_referenceMonth: { cardId, referenceMonth: ref } },
    include: {
      charges: { orderBy: [{ chargeDate: "asc" }, { createdAt: "asc" }] },
      payments: { orderBy: { paidOn: "asc" } },
    },
  });
  const closingDate = inv ? fromDbDate(inv.closingDate) : period.closingDate;
  const projected =
    !inv || inv.status === "OPEN"
      ? (await projectable(ctx, cardId))
          .flatMap((s) => projectSubscription(s, card, closingDate))
          .filter((c) => c.referenceMonth === ref)
      : [];
  const projectedCents = projected.reduce((s, c) => s + c.amountCents, 0n);
  const summary: Omit<InvoiceSummaryDTO, "status"> & { status: InvoiceSummaryDTO["status"] | "FUTURE" } = inv
    ? toInvoiceSummaryDTO(inv)
    : {
        id: "",
        cardId,
        referenceMonth: ref,
        periodStart: period.periodStart,
        closingDate: period.closingDate,
        dueDate: period.dueDate,
        totalCents: 0,
        paidCents: 0,
        balanceCents: 0,
        status: "FUTURE",
        datesOverridden: false,
        updatedAt: new Date(0).toISOString(),
      };
  return {
    ...summary,
    id: inv?.id ?? null,
    materializedCents: summary.totalCents,
    projectedCents: n(projectedCents),
    totalCents: summary.totalCents + n(projectedCents),
    balanceCents: summary.balanceCents + n(projectedCents),
    charges: [
      ...(inv?.charges.map((c) => ({ ...toChargeDTO(c), projected: false })) ?? []),
      ...projected.map((c) => ({
        id: null,
        projected: true,
        sourceType: "SUBSCRIPTION" as const,
        sourceId: c.subscriptionId,
        chargeDate: c.chargeDate,
        description: c.description,
        installment: null,
        amountCents: n(c.amountCents),
        categoryId: c.categoryId,
      })),
    ].sort((a, b) => (a.chargeDate < b.chargeDate ? -1 : a.chargeDate > b.chargeDate ? 1 : 0)),
    payments: inv?.payments.map(toPaymentDTO) ?? [],
    prev: addYearMonths(ref, -1),
    next: addYearMonths(ref, 1),
  };
}

export interface CalendarEventDTO {
  date: DateOnly;
  type: "SUBSCRIPTION_CHARGE" | "INSTALLMENT" | "INVOICE_CLOSING" | "INVOICE_DUE" | "TRIAL_ENDING";
  title: string;
  amountCents: number | null;
  href: string;
  /** Cobrança prevista (ainda não lançada na fatura). */
  projected: boolean;
}

const byDate = (a: CalendarEventDTO, b: CalendarEventDTO) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** RF-052: eventos dos próximos dias (cobranças, fechamentos, vencimentos, fins de teste). */
export async function getUpcoming(ctx: QueryContext, days = 14): Promise<CalendarEventDTO[]> {
  const today = todayOf(ctx);
  const until = addDays(today, days);
  const events: CalendarEventDTO[] = [];
  const cards = await ctx.db.card.findMany({ where: { userId: ctx.user.id, archivedAt: null } });
  for (const s of await projectable(ctx)) {
    const card = cards.find((c) => c.id === s.cardId);
    if (!card) continue;
    for (const c of projectSubscription(s, card, addDays(until, 1))) {
      if (c.chargeDate >= today) {
        events.push({
          date: c.chargeDate,
          type: "SUBSCRIPTION_CHARGE",
          title: s.name,
          amountCents: n(c.amountCents),
          href: `/subscriptions/${s.id}`,
          projected: true,
        });
      }
    }
    if (s.status === "TRIAL" && s.trialEndsOn && s.trialEndsOn >= today && s.trialEndsOn <= until) {
      events.push({
        date: s.trialEndsOn,
        type: "TRIAL_ENDING",
        title: `Fim do teste: ${s.name}`,
        amountCents: n(s.amountCents),
        href: `/subscriptions/${s.id}`,
        projected: false,
      });
    }
  }
  const invoices = await ctx.db.invoice.findMany({
    where: {
      userId: ctx.user.id,
      OR: [
        { closingDate: { gte: toDbDate(today), lte: toDbDate(until) } },
        { dueDate: { gte: toDbDate(today), lte: toDbDate(until) } },
      ],
    },
    include: { card: { select: { nickname: true } } },
  });
  for (const i of invoices) {
    const closing = fromDbDate(i.closingDate);
    const due = fromDbDate(i.dueDate);
    const href = `/cards/${i.cardId}/invoices/${i.referenceMonth}`;
    if (closing >= today && closing <= until)
      events.push({
        date: closing,
        type: "INVOICE_CLOSING",
        title: `Fechamento ${i.card.nickname}`,
        amountCents: null,
        href,
        projected: false,
      });
    if (due >= today && due <= until && i.status !== "PAID") {
      events.push({
        date: due,
        type: "INVOICE_DUE",
        title: `Vencimento ${i.card.nickname}`,
        amountCents: n(i.totalCents - i.paidCents),
        href,
        projected: false,
      });
    }
  }
  return events.sort(byDate);
}

/** Maior intervalo aceito pelo calendário (uma grade de mês com as bordas). */
export const CALENDAR_MAX_DAYS = 42;

/**
 * `/calendar`: tudo que acontece em [from, to] (inclusivo). Cobranças já lançadas vêm das faturas
 * (assinaturas e parcelas); a partir de hoje entram as próximas cobranças previstas das assinaturas.
 * Fechamentos e vencimentos usam a fatura gravada ou, se ela ainda não existe, o ciclo do cartão
 * (do ciclo atual em diante).
 */
export async function getCalendar(
  ctx: QueryContext,
  from: DateOnly,
  to: DateOnly,
): Promise<CalendarEventDTO[]> {
  if (from > to || daysBetween(from, to) >= CALENDAR_MAX_DAYS) {
    throw AppError.validation(`Intervalo inválido: até ${CALENDAR_MAX_DAYS} dias.`);
  }
  const today = todayOf(ctx);
  const events: CalendarEventDTO[] = [];

  const [cards, charges, invoices, subs] = await Promise.all([
    ctx.db.card.findMany({ where: { userId: ctx.user.id } }),
    ctx.db.charge.findMany({
      where: {
        userId: ctx.user.id,
        sourceType: { in: ["SUBSCRIPTION", "INSTALLMENT"] },
        chargeDate: { gte: toDbDate(from), lte: toDbDate(to) },
      },
      orderBy: [{ chargeDate: "asc" }, { createdAt: "asc" }],
    }),
    ctx.db.invoice.findMany({
      where: {
        userId: ctx.user.id,
        OR: [
          { closingDate: { gte: toDbDate(from), lte: toDbDate(to) } },
          { dueDate: { gte: toDbDate(from), lte: toDbDate(to) } },
          // Faturas dos ciclos que o calendário calcularia: as datas gravadas valem sobre o ciclo
          // atual do cartão (que pode ter mudado depois), mesmo quando caem fora do intervalo.
          { referenceMonth: { gte: yearMonthOf(from), lte: addYearMonths(yearMonthOf(to), 2) } },
        ],
      },
    }),
    projectable(ctx),
  ]);
  const nickname = new Map(cards.map((c) => [c.id, c.nickname]));

  const materialized = new Set<string>();
  for (const c of charges) {
    const date = fromDbDate(c.chargeDate);
    if (c.subscriptionId) materialized.add(`${c.subscriptionId}:${date}`);
    events.push({
      date,
      type: c.sourceType === "SUBSCRIPTION" ? "SUBSCRIPTION_CHARGE" : "INSTALLMENT",
      title: c.description,
      amountCents: n(c.amountCents),
      href: c.subscriptionId ? `/subscriptions/${c.subscriptionId}` : "/expenses",
      projected: false,
    });
  }

  const start = from > today ? from : today;
  for (const s of subs) {
    const card = cards.find((c) => c.id === s.cardId && c.archivedAt === null);
    if (!card) continue;
    if (to >= start) {
      for (const c of projectSubscription(s, card, addDays(to, 1))) {
        if (c.chargeDate < start || materialized.has(`${s.id}:${c.chargeDate}`)) continue;
        events.push({
          date: c.chargeDate,
          type: "SUBSCRIPTION_CHARGE",
          title: s.name,
          amountCents: n(c.amountCents),
          href: `/subscriptions/${s.id}`,
          projected: true,
        });
      }
    }
    if (s.status === "TRIAL" && s.trialEndsOn && s.trialEndsOn >= from && s.trialEndsOn <= to) {
      events.push({
        date: s.trialEndsOn,
        type: "TRIAL_ENDING",
        title: `Fim do teste: ${s.name}`,
        amountCents: n(s.amountCents),
        href: `/subscriptions/${s.id}`,
        projected: false,
      });
    }
  }

  // Ciclos que podem fechar ou vencer no intervalo: da referência de `from` até 2 meses depois de `to`.
  const periods = new Map<
    string,
    {
      cardId: string;
      referenceMonth: YearMonth;
      closing: DateOnly;
      due: DateOnly;
      balance: number | null;
      paid: boolean;
    }
  >();
  for (const i of invoices) {
    periods.set(`${i.cardId}:${i.referenceMonth}`, {
      cardId: i.cardId,
      referenceMonth: i.referenceMonth as YearMonth,
      closing: fromDbDate(i.closingDate),
      due: fromDbDate(i.dueDate),
      balance: n(i.totalCents - i.paidCents),
      paid: i.status === "PAID",
    });
  }
  for (const card of cards.filter((c) => c.archivedAt === null)) {
    // Sem fatura gravada, um ciclo anterior ao atual do cartão não tem nada a pagar (antes de o cartão
    // existir, ou enquanto esteve arquivado): só se calculam ciclos do atual em diante.
    const current = invoiceFor(today, card).referenceMonth;
    const first = yearMonthOf(from) > current ? yearMonthOf(from) : current;
    for (let ref = first; ref <= addYearMonths(yearMonthOf(to), 2); ref = addYearMonths(ref, 1)) {
      const key = `${card.id}:${ref}`;
      if (periods.has(key)) continue;
      const p = invoiceForReference(ref, card);
      periods.set(key, {
        cardId: card.id,
        referenceMonth: ref,
        closing: p.closingDate,
        due: p.dueDate,
        balance: null,
        paid: false,
      });
    }
  }
  for (const p of periods.values()) {
    const name = nickname.get(p.cardId) ?? "Cartão";
    const href = `/cards/${p.cardId}/invoices/${p.referenceMonth}`;
    if (p.closing >= from && p.closing <= to) {
      events.push({
        date: p.closing,
        type: "INVOICE_CLOSING",
        title: `Fechamento ${name}`,
        amountCents: null,
        href,
        projected: false,
      });
    }
    if (p.due >= from && p.due <= to && !p.paid) {
      events.push({
        date: p.due,
        type: "INVOICE_DUE",
        title: `Vencimento ${name}`,
        amountCents: p.balance,
        href,
        projected: false,
      });
    }
  }
  return events.sort(byDate);
}

/** RF-050 a RF-056: painel principal do mês. */
/** Fatura atual de cada cartão (lançado + previsto); a projeção começa no ciclo atual de cada cartão. */
function withCurrentForecast(
  cards: Awaited<ReturnType<typeof listCards>>,
  projection: Awaited<ReturnType<typeof getProjection>>,
  today: DateOnly,
) {
  return cards.map((c) => {
    const period = invoiceFor(today, c);
    const forecast = projection.months
      .find((m) => m.referenceMonth === period.referenceMonth)
      ?.byCard.find((b) => b.cardId === c.id);
    return {
      id: c.id,
      nickname: c.nickname,
      issuer: c.issuer,
      brand: c.brand,
      last4: c.last4,
      color: c.color,
      closingDay: c.closingDay,
      dueDay: c.dueDay,
      limitCents: c.limitCents,
      usedLimitCents: c.usedLimitCents,
      archivedAt: c.archivedAt,
      currentInvoice: {
        referenceMonth: period.referenceMonth,
        dueDate: c.currentInvoice?.dueDate ?? period.dueDate,
        status: c.currentInvoice?.status ?? ("OPEN" as const),
        totalCents: forecast?.totalCents ?? c.currentInvoice?.totalCents ?? 0,
        projectedCents: forecast?.projectedCents ?? 0,
      },
    };
  });
}

/** `/cards`: todos os cartões (arquivados por último) com a fatura atual, igual à do painel. */
export async function getCardsOverview(ctx: QueryContext) {
  const [cards, projection] = await Promise.all([
    listCards(ctx, { includeArchived: true }),
    getProjection(ctx, 1),
  ]);
  return withCurrentForecast(cards, projection, todayOf(ctx));
}

export async function getDashboard(ctx: QueryContext, month?: string) {
  const today = todayOf(ctx);
  const ref: YearMonth = month ? parseYearMonth(month) : yearMonthOf(today);
  const [cards, recurring, overdue, upcoming, projection, byCategoryRows] = await Promise.all([
    listCards(ctx),
    recurringMonthlyCents(ctx),
    ctx.db.invoice.findMany({
      where: { userId: ctx.user.id, status: "OVERDUE" },
      orderBy: { dueDate: "asc" },
    }),
    getUpcoming(ctx, 14),
    getProjection(ctx, 13),
    ctx.db.$queryRaw<{ category_id: string | null; total_cents: bigint }[]>`
      SELECT c.category_id, SUM(c.amount_cents)::bigint AS total_cents
      FROM charges c JOIN invoices i ON i.id = c.invoice_id
      WHERE c.user_id = ${ctx.user.id}::uuid AND i.reference_month = ${ref}
      GROUP BY c.category_id ORDER BY total_cents DESC`,
  ]);
  const categories = await ctx.db.category.findMany({ where: { userId: ctx.user.id } });
  // RF-050: todas as faturas com vencimento no mês (RN-04: referenceMonth = mês do vencimento),
  // inclusive já fechadas, + cobranças previstas das faturas abertas/futuras.
  const committedIn = async (m: YearMonth) => {
    const materialized = await ctx.db.invoice.aggregate({
      where: { userId: ctx.user.id, referenceMonth: m },
      _sum: { totalCents: true },
    });
    const projected = projection.months
      .filter((p) => p.referenceMonth === m)
      .flatMap((p) => p.byCard)
      .reduce((sum, c) => sum + c.projectedCents, 0);
    return n(materialized._sum.totalCents ?? 0n) + projected;
  };
  const [committed, previous] = await Promise.all([committedIn(ref), committedIn(addYearMonths(ref, -1))]);
  return {
    month: ref,
    committedThisMonthCents: committed,
    previousMonthCents: previous,
    recurringMonthlyCents: n(recurring),
    // RF-055: próximos 12 ciclos a partir do atual (o 13º só serve ao comprometido do mês).
    projection: projection.months.slice(0, 12),
    cards: withCurrentForecast(cards, projection, today),
    overdueInvoices: overdue.map(toInvoiceSummaryDTO),
    upcoming,
    limitUsage: cards
      .filter((c) => c.limitCents !== null)
      .map((c) => ({
        cardId: c.id,
        nickname: c.nickname,
        usedCents: c.usedLimitCents ?? 0,
        limitCents: c.limitCents ?? 0,
      })),
    byCategory: byCategoryRows.map((r) => {
      const cat = categories.find((c) => c.id === r.category_id);
      return {
        category: cat ? { id: cat.id, name: cat.name, color: cat.color, icon: cat.icon } : null,
        totalCents: n(r.total_cents),
      };
    }),
  };
}
