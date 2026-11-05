import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Equal,
  Repeat,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { currentUser } from "@/lib/session";
import { todayOf } from "@/shared/application/context";
import { addYearMonths, type YearMonth } from "@/shared/domain/date-only";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";
import { brl, dayMonth, monthLabel, monthName } from "@/shared/ui/format";
import { MoneyDisplay } from "@/shared/ui/money-display";

import { getDashboard } from "@/modules/dashboard";
import { CategoryBreakdown } from "@/modules/dashboard/ui/components/category-breakdown";
import { ProjectionChart } from "@/modules/dashboard/ui/components/projection-chart";
import { UpcomingList } from "@/modules/dashboard/ui/components/upcoming-list";

import { CardSummary } from "./card-summary";

export const metadata: Metadata = { title: "Início — FinFlow" };

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl bg-surface p-5 shadow-hairline sm:p-6 ${className}`}>
      <h2 className="font-display text-heading-sm">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Variação contra o mês anterior, em tom neutro (DESIGN §1: calma antes de alarme). */
function Variation({
  current,
  previous,
  previousMonth,
}: {
  current: number;
  previous: number;
  previousMonth: string;
}) {
  if (current === 0 && previous === 0) return null;
  const diff = current - previous;
  const pct = previous > 0 ? ` (${diff > 0 ? "+" : ""}${Math.round((diff / previous) * 100)}%)` : "";
  const [Icon, text] =
    diff > 0
      ? [TrendingUp, `${brl(diff)} a mais que em ${monthName(previousMonth)}${pct}`]
      : diff < 0
        ? [TrendingDown, `${brl(-diff)} a menos que em ${monthName(previousMonth)}${pct}`]
        : [Equal, `Igual a ${monthName(previousMonth)}`];
  return (
    <p className="mt-3 flex items-start gap-1.5 text-body-sm text-fg-muted">
      <Icon aria-hidden size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

/** Painel principal (RF-050 a RF-056; DESIGN §7). */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const { mes } = await searchParams;
  const ctx = { db: prisma(), user, clock: systemClock };
  const d = await getDashboard(ctx, typeof mes === "string" && YEAR_MONTH.test(mes) ? mes : undefined);
  const today = todayOf(ctx);
  const month = d.month as YearMonth;
  const previousMonth = addYearMonths(month, -1);
  const nickname = (cardId: string) => d.cards.find((c) => c.id === cardId)?.nickname ?? "Cartão";

  return (
    <div className="flex flex-col gap-8 lg:gap-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-heading-lg">Início</h1>
        <nav
          aria-label="Mês do painel"
          className="flex items-center gap-1 rounded-full bg-surface-subtle p-1 text-label"
        >
          <Link
            href={{ pathname: "/dashboard", query: { mes: previousMonth } }}
            aria-label={`Ver ${monthLabel(previousMonth)}`}
            className="grid size-8 place-items-center rounded-full text-fg-muted hover:bg-surface hover:text-fg"
          >
            <ChevronLeft aria-hidden size={18} strokeWidth={1.5} />
          </Link>
          <span
            aria-live="polite"
            className="min-w-36 rounded-full bg-surface px-3 py-1.5 text-center shadow-sm"
          >
            {monthLabel(month)}
          </span>
          <Link
            href={{ pathname: "/dashboard", query: { mes: addYearMonths(month, 1) } }}
            aria-label={`Ver ${monthLabel(addYearMonths(month, 1))}`}
            className="grid size-8 place-items-center rounded-full text-fg-muted hover:bg-surface hover:text-fg"
          >
            <ChevronRight aria-hidden size={18} strokeWidth={1.5} />
          </Link>
        </nav>
      </header>

      <section aria-labelledby="total-mes" className="rounded-xl bg-surface p-6 shadow-hairline sm:p-10">
        <h2 id="total-mes" className="text-body-sm text-fg-muted">
          Comprometido em {monthName(month)}
        </h2>
        <p className="mt-2">
          <MoneyDisplay cents={d.committedThisMonthCents} size="display" />
        </p>
        <Variation
          current={d.committedThisMonthCents}
          previous={d.previousMonthCents}
          previousMonth={previousMonth}
        />
        <p className="mt-6 flex items-start gap-2 border-t border-border pt-4 text-body text-fg-muted">
          <Repeat aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-iris-500" />
          <span>
            Assinaturas somam{" "}
            <strong className="font-semibold text-fg tabular-nums">{brl(d.recurringMonthlyCents)}</strong> por
            mês
          </span>
        </p>
      </section>

      {d.overdueInvoices.length > 0 && (
        <section role="alert" className="flex gap-3 rounded-xl bg-status-danger p-5 text-status-danger-fg">
          <CircleAlert aria-hidden size={20} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold">
              {d.overdueInvoices.length === 1
                ? "Uma fatura vencida"
                : `${d.overdueInvoices.length} faturas vencidas`}
            </h2>
            <ul className="mt-1 text-body-sm">
              {d.overdueInvoices.map((i) => (
                <li key={i.id}>
                  {nickname(i.cardId)}: {brl(i.balanceCents)}, venceu em {dayMonth(i.dueDate)}. Registre o
                  pagamento quando pagar.
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="cartoes">
        <h2 id="cartoes" className="font-display text-heading-sm">
          Seus cartões
        </h2>
        {d.cards.length === 0 ? (
          // shortcut: estado vazio sem botão até existir o cadastro de cartões (DESIGN §6.11 pede 1 botão primary).
          <div className="mt-4 rounded-xl bg-surface p-8 text-center shadow-hairline">
            <h3 className="font-display text-heading-sm">Nenhum cartão ainda</h3>
            <p className="mt-2 text-body text-fg-muted">
              Crie seu primeiro cartão para começar a acompanhar suas faturas.
            </p>
          </div>
        ) : (
          <div className="relative -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:px-0">
            {d.cards.map((c) => (
              <div key={c.id} className="w-[280px] shrink-0 snap-start lg:w-auto lg:min-w-0">
                <CardSummary {...c} />
              </div>
            ))}
          </div>
        )}
      </section>

      <Panel title="Próximos 12 meses">
        <ProjectionChart months={d.projection} cards={d.cards} />
      </Panel>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-4">
        <Panel title="Próximos 14 dias">
          <UpcomingList events={d.upcoming} today={today} />
        </Panel>
        <Panel title={`Gastos de ${monthName(month)} por categoria`}>
          <CategoryBreakdown items={d.byCategory} />
        </Panel>
      </div>
    </div>
  );
}
