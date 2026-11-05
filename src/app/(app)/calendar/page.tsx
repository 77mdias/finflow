import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUser } from "@/lib/session";
import { todayOf } from "@/shared/application/context";
import {
  isDateOnly,
  isYearMonth,
  yearMonthOf,
  type DateOnly,
  type YearMonth,
} from "@/shared/domain/date-only";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";
import { brl, dayLabel, fullDate } from "@/shared/ui/format";
import { MonthNav } from "@/shared/ui/month-nav";

import { getCalendar, monthGrid, type CalendarEventDTO } from "@/modules/dashboard";
import { EventRow } from "@/modules/dashboard/ui/components/upcoming-list";

export const metadata: Metadata = { title: "Calendário — FinFlow" };

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Marcadores (DESIGN §6.6): cobranças em `--primary`; fechamento, vencimento e teste nas cores de status. */
const MARKERS = [
  { key: "charge", label: "Cobranças", dot: "bg-primary" },
  { key: "closing", label: "Fechamento", dot: "bg-status-warning-fg" },
  { key: "due", label: "Vencimento", dot: "bg-status-danger-fg" },
  // Anel vazado: a cor info fica perto de `--primary`, então o formato também diferencia.
  { key: "trial", label: "Fim do teste", dot: "border-[1.5px] border-status-info-fg" },
] as const;
type Marker = (typeof MARKERS)[number]["key"];

/** Exaustivo: um tipo de evento novo não compila sem marcador. */
const MARKER_OF: Record<CalendarEventDTO["type"], Marker> = {
  SUBSCRIPTION_CHARGE: "charge",
  INSTALLMENT: "charge",
  INVOICE_CLOSING: "closing",
  INVOICE_DUE: "due",
  TRIAL_ENDING: "trial",
};
const isCharge = (e: CalendarEventDTO) => MARKER_OF[e.type] === "charge";

const hrefOf = (month: YearMonth, day?: DateOnly) =>
  ({ pathname: "/calendar", query: day ? { mes: month, dia: day } : { mes: month } }) as const;

/** Resumo do dia para leitores de tela: "3 de novembro: 2 cobranças, vencimento". */
function cellLabel(day: DateOnly, events: CalendarEventDTO[]): string {
  const date = fullDate(day);
  if (events.length === 0) return `${date}: nada previsto`;
  const parts = MARKERS.map((m) => ({ m, count: events.filter((e) => MARKER_OF[e.type] === m.key).length }))
    .filter((x) => x.count > 0)
    .map(({ m, count }) =>
      m.key === "charge" ? `${count} ${count === 1 ? "cobrança" : "cobranças"}` : m.label.toLowerCase(),
    );
  return `${date}: ${parts.join(", ")}`;
}

/**
 * Calendário (VISUAL_BRIEF §6 tela 6): mês com marcadores por dia e a lista do dia escolhido.
 * Cobranças passadas vêm das faturas; a partir de hoje entram as previstas das assinaturas.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; dia?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const ctx = { db: prisma(), user, clock: systemClock };
  const params = await searchParams;
  const today = todayOf(ctx);
  const month: YearMonth = params.mes && isYearMonth(params.mes) ? params.mes : yearMonthOf(today);
  const grid = monthGrid(month);
  const events = await getCalendar(ctx, grid[0]!, grid.at(-1)!);

  const byDay = new Map<string, CalendarEventDTO[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  // Dia escolhido: o da URL (se estiver na grade), hoje (se for deste mês) ou o dia 1º.
  const selected: DateOnly =
    params.dia && isDateOnly(params.dia) && grid.includes(params.dia)
      ? params.dia
      : yearMonthOf(today) === month
        ? today
        : (`${month}-01` as DateOnly);
  const dayEvents = byDay.get(selected) ?? [];
  const dayCharges = dayEvents.filter(isCharge).reduce((sum, e) => sum + (e.amountCents ?? 0), 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-heading-lg">Calendário</h1>
        <MonthNav month={month} href={(m) => hrefOf(m)} />
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <section aria-label="Mês" className="min-w-0 rounded-xl bg-surface p-3 shadow-hairline sm:p-5">
          <div className="grid grid-cols-7 text-center" aria-hidden>
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-2 text-overline text-fg-muted">
                {w}
              </span>
            ))}
          </div>
          <ol className="grid grid-cols-7 gap-1">
            {grid.map((day) => {
              const list = byDay.get(day) ?? [];
              const outside = !day.startsWith(month);
              const isSelected = day === selected;
              const markers = MARKERS.filter((m) => list.some((e) => MARKER_OF[e.type] === m.key));
              return (
                <li key={day}>
                  <Link
                    href={hrefOf(month, day)}
                    scroll={false}
                    aria-label={cellLabel(day, list)}
                    aria-current={isSelected ? "date" : undefined}
                    className={[
                      "flex min-h-14 flex-col items-center gap-1 rounded-md pt-1.5 pb-2 transition-colors duration-150 sm:min-h-20",
                      isSelected ? "bg-tonal text-tonal-fg" : "hover:bg-surface-subtle",
                      outside && !isSelected ? "text-fg-subtle" : "",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "grid size-7 place-items-center rounded-full text-label tabular-nums",
                        day === today ? "bg-primary text-primary-fg" : "",
                      ].join(" ")}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {markers.length > 0 && (
                      <span aria-hidden className="flex gap-1">
                        {markers.map((m) => (
                          <span key={m.key} className={`size-1.5 rounded-full ${m.dot}`} />
                        ))}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
          <ul
            aria-label="Legenda"
            className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-1 text-body-sm text-fg-muted"
          >
            {MARKERS.map((m) => (
              <li key={m.key} className="flex items-center gap-2">
                <span aria-hidden className={`size-2 rounded-full ${m.dot}`} />
                {m.label}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="dia" className="min-w-0 rounded-xl bg-surface p-5 shadow-hairline sm:p-6">
          <h2 id="dia" className="font-display text-heading-sm">
            {dayLabel(selected, today)}
          </h2>
          <p className="mt-1 text-body-sm text-fg-muted">
            {fullDate(selected)}
            {dayCharges > 0 && (
              <>
                {" · "}
                <span className="text-fg tabular-nums">{brl(dayCharges)}</span> em cobranças
              </>
            )}
          </p>
          {dayEvents.length === 0 ? (
            <p className="mt-5 text-body text-fg-muted">Nada acontece neste dia.</p>
          ) : (
            <ul className="mt-3">
              {dayEvents.map((e, i) => (
                <EventRow key={`${e.type}-${e.href}-${i}`} event={e} />
              ))}
            </ul>
          )}
          <p className="mt-6 text-body-sm text-fg-muted">
            Valores com &quot;prevista&quot; são estimativas das assinaturas e entram na fatura no dia da
            cobrança.{" "}
            <Link href="/subscriptions" className="text-fg underline-offset-4 hover:underline">
              Ver assinaturas
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
