import { ChevronLeft } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { currentUser } from "@/lib/session";
import { todayOf } from "@/shared/application/context";
import { Id } from "@/shared/application/schemas";
import { isYearMonth, type DateOnly } from "@/shared/domain/date-only";
import { isAppError } from "@/shared/domain/errors";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";
import { brl, dayLabel, dayMonth, monthLabel, monthName } from "@/shared/ui/format";
import { MoneyDisplay } from "@/shared/ui/money-display";
import { MonthNav } from "@/shared/ui/month-nav";

import { getCard, listCards } from "@/modules/cards";
import { ArchiveCardButton, UnarchiveCardButton } from "@/modules/cards/ui/components/archive-card";
import { EditCardButton } from "@/modules/cards/ui/components/card-form";
import { CardThumb } from "@/modules/cards/ui/components/card-visual";
import { listCategories } from "@/modules/categories";
import { getInvoiceView } from "@/modules/dashboard";
import { ChargeRow } from "@/modules/invoices/ui/components/charge-row";
import { InvoiceStatusBadge } from "@/modules/invoices/ui/components/invoice-status-badge";
import { DeletePaymentButton, RegisterPaymentButton } from "@/modules/invoices/ui/components/payment-dialogs";

export const metadata: Metadata = { title: "Fatura — FinFlow" };

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl bg-surface p-5 shadow-hairline sm:p-6">
      <h2 className="font-display text-heading-sm">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Fatura (VISUAL_BRIEF §6 tela 2, DESIGN §7, FLOW_MAP §10): quanto devo, até quando e por quê. */
export default async function InvoicePage({ params }: { params: Promise<{ id: string; ref: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const { id, ref } = await params;
  if (!Id.safeParse(id).success || !isYearMonth(ref)) notFound();
  const ctx = { db: prisma(), user, clock: systemClock };
  const [card, invoice, cards, categories] = await Promise.all([
    getCard(ctx, id),
    getInvoiceView(ctx, id, ref),
    listCards(ctx),
    listCategories(ctx.db, user.id),
  ]).catch((e: unknown) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const today = todayOf(ctx);
  const category = (categoryId: string | null) => categories.find((c) => c.id === categoryId)?.name ?? null;
  const archived = card.archivedAt !== null;

  // O saldo da tela inclui o previsto; só o lançado pode ser pago (RF-044).
  const payableCents = invoice.balanceCents - invoice.projectedCents;
  const [heroLabel, heroCents] =
    invoice.status !== "PAID" && invoice.paidCents > 0
      ? ["Falta pagar", invoice.balanceCents]
      : ["Total da fatura", invoice.totalCents];

  const byDate = new Map<string, typeof invoice.charges>();
  for (const c of invoice.charges) byDate.set(c.chargeDate, [...(byDate.get(c.chargeDate) ?? []), c]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Link
          href="/cards"
          className="-ml-1 inline-flex items-center gap-1 rounded-md text-body-sm text-fg-muted hover:text-fg"
        >
          <ChevronLeft aria-hidden size={16} strokeWidth={1.5} />
          Cartões
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <CardThumb issuer={card.issuer} color={card.color} archived={archived} />
            <div className="min-w-0">
              <h1 className="truncate font-display text-heading-lg">{card.nickname}</h1>
              <p className="text-body-sm text-fg-muted">
                Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                {archived && " · Arquivado"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <EditCardButton card={card} />
            {archived ? (
              <UnarchiveCardButton id={card.id} nickname={card.nickname} />
            ) : (
              <ArchiveCardButton
                card={card}
                otherCards={cards
                  .filter((c) => c.id !== card.id)
                  .map(({ id, nickname }) => ({ id, nickname }))}
              />
            )}
          </div>
        </div>
      </header>

      <section aria-labelledby="fatura" className="rounded-xl bg-surface p-6 shadow-hairline sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="fatura" className="font-display text-heading-sm">
            Fatura de {monthName(ref)}
          </h2>
          <MonthNav month={ref} label="Mês da fatura" href={(m) => `/cards/${id}/invoices/${m}` as Route} />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="text-body-sm text-fg-muted">{heroLabel}</p>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <p className="mt-2">
          <MoneyDisplay cents={heroCents} size="display" />
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
          <div className="flex gap-1.5">
            <dt className="text-fg-muted">Fecha em</dt>
            <dd className="tabular-nums">{dayMonth(invoice.closingDate)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-fg-muted">Vence em</dt>
            <dd className="tabular-nums">{dayMonth(invoice.dueDate)}</dd>
          </div>
          {invoice.paidCents > 0 && (
            <div className="flex gap-1.5">
              <dt className="text-fg-muted">Pago</dt>
              <dd className="tabular-nums">
                {brl(invoice.paidCents)} de {brl(invoice.totalCents)}
              </dd>
            </div>
          )}
          {invoice.projectedCents > 0 && (
            <div className="flex gap-1.5">
              <dt className="text-fg-muted">Previsto</dt>
              <dd className="tabular-nums">{brl(invoice.projectedCents)}</dd>
            </div>
          )}
        </dl>
        {invoice.id && invoice.status !== "PAID" && payableCents > 0 && (
          <div className="mt-6 border-t border-border pt-6">
            <RegisterPaymentButton invoiceId={invoice.id} balanceCents={payableCents} today={today} />
          </div>
        )}
      </section>

      <Panel title="Cobranças">
        {byDate.size === 0 ? (
          <p className="text-body text-fg-muted">Nenhuma cobrança nesta fatura.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {[...byDate].map(([date, charges]) => (
              <section key={date} aria-label={dayLabel(date as DateOnly, today)}>
                <h3 className="text-label text-fg-muted">{dayLabel(date as DateOnly, today)}</h3>
                <ul className="mt-1">
                  {charges.map((c, i) => (
                    <ChargeRow
                      key={c.id ?? `previsto-${c.sourceId}-${i}`}
                      {...c}
                      category={category(c.categoryId)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Panel>

      {invoice.id && (
        <Panel title="Pagamentos">
          {invoice.payments.length === 0 ? (
            <p className="text-body text-fg-muted">Nenhum pagamento registrado.</p>
          ) : (
            <ul>
              {invoice.payments.map((p) => {
                const label = `${brl(p.amountCents)} em ${dayMonth(p.paidOn)}`;
                return (
                  <li
                    key={p.id}
                    className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-body">Pago em {dayMonth(p.paidOn)}</p>
                      {p.note && <p className="truncate text-body-sm text-fg-muted">{p.note}</p>}
                    </div>
                    <span className="text-body tabular-nums">{brl(p.amountCents)}</span>
                    <DeletePaymentButton paymentId={p.id} label={label} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {card.invoices.length > 0 && (
        <Panel title="Histórico de faturas">
          <ul>
            {card.invoices.map((i) => (
              <li key={i.id} className="border-b border-border last:border-b-0">
                <Link
                  href={`/cards/${id}/invoices/${i.referenceMonth}` as Route}
                  aria-current={i.referenceMonth === ref ? "page" : undefined}
                  className="-mx-3 grid min-h-14 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md px-3 hover:bg-surface-subtle aria-[current=page]:bg-surface-subtle"
                >
                  <span className="truncate text-body">{monthLabel(i.referenceMonth)}</span>
                  <InvoiceStatusBadge status={i.status} />
                  <span className="min-w-24 text-right text-body tabular-nums">
                    {brl(i.referenceMonth === ref ? invoice.totalCents : i.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
