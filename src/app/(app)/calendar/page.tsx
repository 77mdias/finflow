/* Hallmark · redesign: full · shape: app screen · theme: locked (DESIGN.md) · genre: modern-minimal
 * signature: the month as a ledger, each day carrying its own total and naming its due dates
 * pre-emit critique: P4 H4 E4 S4 R4 V3 · weakest: V, the grid is still a month grid; earned by putting the money and the card names in the cells */
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
import { brl, dayLabel, decimal, fullDate, monthName } from "@/shared/ui/format";
import { MoneyDisplay } from "@/shared/ui/money-display";
import { MonthNav } from "@/shared/ui/month-nav";

import { getCalendar, monthGrid, type CalendarEventDTO } from "@/modules/dashboard";
import { EVENT_TYPES, EventRow } from "@/modules/dashboard/ui/components/upcoming-list";

export const metadata: Metadata = { title: "Calendário — FinFlow" };

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Marcadores: cobranças viram o valor do dia; fechamento, vencimento e teste viram selos (DESIGN §6.6). */
const MARKERS = [
  { key: "charge", label: "Cobranças" },
  { key: "closing", label: "Fechamento", type: "INVOICE_CLOSING" },
  { key: "due", label: "Vencimento", type: "INVOICE_DUE" },
  { key: "trial", label: "Fim do teste", type: "TRIAL_ENDING" },
] as const;
type Marker = (typeof MARKERS)[number]["key"];
const DATE_MARKERS = MARKERS.filter((m) => m.key !== "charge");

/** Exaustivo: um tipo de evento novo não compila sem marcador. */
const MARKER_OF: Record<CalendarEventDTO["type"], Marker> = {
  SUBSCRIPTION_CHARGE: "charge",
  INSTALLMENT: "charge",
  INVOICE_CLOSING: "closing",
  INVOICE_DUE: "due",
  TRIAL_ENDING: "trial",
};
/** Cor de status + ícone do tipo: o ícone diferencia o selo sem depender da cor. */
const TONE: Record<Exclude<Marker, "charge">, string> = {
  closing: "bg-status-warning text-status-warning-fg",
  due: "bg-status-danger text-status-danger-fg",
  trial: "bg-status-info text-status-info-fg",
};
const isCharge = (e: CalendarEventDTO) => MARKER_OF[e.type] === "charge";
const toneOf = (e: CalendarEventDTO) => TONE[MARKER_OF[e.type] as Exclude<Marker, "charge">];

// shortcut: tira o prefixo do título montado em getCalendar ("Vencimento Rosinha" → "Rosinha");
// se o título mudar, o selo mostra o título inteiro. Trocar por um campo próprio no DTO se precisar.
const subjectOf = (e: CalendarEventDTO) => e.title.replace(/^(Fechamento|Vencimento|Fim do teste:)\s+/, "");

const sumCents = (events: CalendarEventDTO[]) => events.reduce((sum, e) => sum + (e.amountCents ?? 0), 0);
const REAIS = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const hrefOf = (month: YearMonth, day?: DateOnly) =>
  ({ pathname: "/calendar", query: day ? { mes: month, dia: day } : { mes: month } }) as const;

/** Resumo do dia para leitores de tela: "03/11/2026: 2 cobranças (R$ 54,80), vencimento". */
function cellLabel(day: DateOnly, events: CalendarEventDTO[]): string {
  const date = fullDate(day);
  if (events.length === 0) return `${date}: nada previsto`;
  const parts = MARKERS.map((m) => ({ m, list: events.filter((e) => MARKER_OF[e.type] === m.key) }))
    .filter((x) => x.list.length > 0)
    .map(({ m, list }) =>
      m.key === "charge"
        ? `${list.length} ${list.length === 1 ? "cobrança" : "cobranças"} (${brl(sumCents(list))})`
        : m.label.toLowerCase(),
    );
  return `${date}: ${parts.join(", ")}`;
}

/** Total do dia na célula: reais inteiros no celular, centavos menores no alto a partir de `md` (DESIGN §3.2). */
function CellAmount({ cents, projected }: { cents: number; projected: boolean }) {
  const [int, frac] = decimal(cents).split(",");
  return (
    <span
      className={[
        "mt-auto self-end text-caption tabular-nums md:text-body-sm",
        // Previsto ≠ confirmado: cor apagada e sublinhado tracejado, nunca só a cor.
        projected
          ? "text-fg-muted underline decoration-border-strong decoration-dashed underline-offset-4"
          : "text-fg",
      ].join(" ")}
    >
      <span className="md:hidden">{REAIS.format(cents / 100)}</span>
      <span className="hidden md:inline">
        {int}
        <span className="align-top text-[0.75em] leading-none">,{frac}</span>
      </span>
    </span>
  );
}

/**
 * Calendário (VISUAL_BRIEF §6 tela 6): o mês como um livro-razão, cada dia com o próprio total e
 * os vencimentos nomeados, e a lista do dia escolhido ao lado.
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
  const dayCharges = sumCents(dayEvents.filter(isCharge));

  const monthChargeEvents = events.filter((e) => isCharge(e) && e.date.startsWith(month));
  const monthCharges = sumCents(monthChargeEvents);
  const monthProjected = sumCents(monthChargeEvents.filter((e) => e.projected));
  const name = monthName(month);
  // Faixa da semana de hoje, quando ela aparece na grade.
  const todayRow = grid.includes(today) ? Math.floor(grid.indexOf(today) / 7) : -1;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-heading-lg">Calendário</h1>
          <MonthNav month={month} href={(m) => hrefOf(m)} />
        </div>
        {monthCharges > 0 ? (
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-body text-fg-muted">
            <MoneyDisplay cents={monthCharges} size="heading" />
            <span>
              {monthProjected === monthCharges
                ? `em cobranças previstas para ${name}`
                : `em cobranças em ${name}`}
              {monthProjected > 0 && monthProjected < monthCharges && (
                <>
                  , <span className="text-fg tabular-nums">{brl(monthProjected)}</span> ainda previstos
                </>
              )}
            </span>
          </p>
        ) : (
          <p className="text-body text-fg-muted">Nenhuma cobrança em {name}.</p>
        )}
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Mês" className="min-w-0 overflow-hidden rounded-xl bg-surface shadow-hairline">
          <div className="grid grid-cols-7 border-b border-border" aria-hidden>
            {WEEKDAYS.map((w) => (
              <span key={w} className="px-1.5 py-2.5 text-caption text-fg-muted md:px-3">
                {w}
              </span>
            ))}
          </div>
          <ol className="grid grid-cols-7">
            {grid.map((day, i) => {
              const list = byDay.get(day) ?? [];
              const charges = list.filter(isCharge);
              const dated = list.filter((e) => !isCharge(e));
              const outside = !day.startsWith(month);
              const isSelected = day === selected;
              return (
                <li
                  key={day}
                  className={[
                    "border-border",
                    i % 7 > 0 ? "border-l" : "",
                    i >= 7 ? "border-t" : "",
                    Math.floor(i / 7) === todayRow ? "bg-surface-subtle" : "",
                  ].join(" ")}
                >
                  <Link
                    href={hrefOf(month, day)}
                    scroll={false}
                    aria-label={cellLabel(day, list)}
                    aria-current={isSelected ? "date" : undefined}
                    className={[
                      "flex h-full min-h-16 flex-col gap-1 p-1 transition-colors duration-150 -outline-offset-2 md:min-h-28 md:gap-1.5 md:p-2",
                      isSelected ? "bg-tonal" : "hover:bg-surface-muted",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "grid size-7 shrink-0 place-items-center rounded-full text-label tabular-nums",
                        day === today
                          ? "bg-primary text-primary-fg"
                          : isSelected
                            ? "text-tonal-fg"
                            : outside
                              ? "text-fg-subtle"
                              : "text-fg",
                      ].join(" ")}
                    >
                      {Number(day.slice(8))}
                    </span>

                    {dated.length > 0 && (
                      <>
                        {/* Celular: só o ícone de cada tipo; a partir de md, o selo com o nome. */}
                        <span className="flex flex-wrap gap-0.5 md:hidden">
                          {DATE_MARKERS.filter((m) => dated.some((e) => e.type === m.type)).map((m) => {
                            const { Icon } = EVENT_TYPES[m.type];
                            return (
                              <span
                                key={m.key}
                                className={`grid size-4 place-items-center rounded-full ${TONE[m.key]}`}
                              >
                                <Icon aria-hidden size={10} strokeWidth={2} />
                              </span>
                            );
                          })}
                        </span>
                        <span className="hidden min-w-0 flex-col gap-1 md:flex">
                          {dated.slice(0, 2).map((e, j) => {
                            const { Icon } = EVENT_TYPES[e.type];
                            return (
                              <span
                                key={`${e.type}-${e.href}-${j}`}
                                title={e.title}
                                className={`flex min-w-0 items-start gap-1 rounded-sm px-1.5 py-1 text-caption ${toneOf(e)}`}
                              >
                                <Icon aria-hidden size={12} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                                <span className="line-clamp-2 min-w-0 break-words">{subjectOf(e)}</span>
                              </span>
                            );
                          })}
                          {dated.length > 2 && (
                            <span className="px-1.5 text-caption text-fg-muted">mais {dated.length - 2}</span>
                          )}
                        </span>
                      </>
                    )}

                    {charges.length > 0 && (
                      <CellAmount cents={sumCents(charges)} projected={charges.every((e) => e.projected)} />
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
          <ul
            aria-label="Legenda"
            className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-3 py-3 text-caption text-fg-muted md:px-4"
          >
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="text-fg tabular-nums">
                0,00
              </span>
              Total de cobranças do dia
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="tabular-nums underline decoration-border-strong decoration-dashed underline-offset-4"
              >
                0,00
              </span>
              Previstas
            </li>
            {DATE_MARKERS.map((m) => {
              const { Icon } = EVENT_TYPES[m.type];
              return (
                <li key={m.key} className="flex items-center gap-1.5">
                  <span aria-hidden className={`grid size-4 place-items-center rounded-full ${TONE[m.key]}`}>
                    <Icon size={10} strokeWidth={2} />
                  </span>
                  {m.label}
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-labelledby="dia"
          className="min-w-0 rounded-xl bg-surface p-5 shadow-hairline sm:p-6 xl:sticky xl:top-10 xl:self-start"
        >
          <h2 id="dia" className="font-display text-heading">
            {dayLabel(selected, today)}
          </h2>
          <p className="mt-1 text-body-sm text-fg-muted">{fullDate(selected)}</p>
          {dayCharges > 0 && (
            <p className="mt-3 text-body-sm text-fg-muted">
              <span className="text-body text-fg tabular-nums">{brl(dayCharges)}</span> em cobranças
            </p>
          )}
          {dayEvents.length === 0 ? (
            <p className="mt-5 text-body text-fg-muted">Nada acontece neste dia.</p>
          ) : (
            <ul className="mt-3">
              {dayEvents.map((e, i) => (
                <EventRow key={`${e.type}-${e.href}-${i}`} event={e} />
              ))}
            </ul>
          )}
          <p className="mt-6 border-t border-border pt-4 text-body-sm text-fg-muted">
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
