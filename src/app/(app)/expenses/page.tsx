import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUser } from "@/lib/session";
import { todayOf } from "@/shared/application/context";
import { Id } from "@/shared/application/schemas";
import { isYearMonth, yearMonthOf, type DateOnly, type YearMonth } from "@/shared/domain/date-only";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";
import { button } from "@/shared/ui/button";
import { brl, dayLabel, monthName, monthShort } from "@/shared/ui/format";
import { MoneyDisplay } from "@/shared/ui/money-display";
import { MonthNav } from "@/shared/ui/month-nav";

import { listCardOptions, listCards } from "@/modules/cards";
import { NewCardButton } from "@/modules/cards/ui/components/card-form";
import { listCategories } from "@/modules/categories";
import { listExpenses, type ExpenseDTO } from "@/modules/expenses";
import {
  DeleteExpenseButton,
  EditExpenseButton,
  NewExpenseButton,
} from "@/modules/expenses/ui/components/expense-form";

export const metadata: Metadata = { title: "Despesas — FinFlow" };

const CHIP =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-label transition-colors duration-150 " +
  "text-fg-muted shadow-[inset_0_0_0_1px_var(--border-strong)] hover:bg-surface-subtle hover:text-fg " +
  "aria-[current=page]:bg-tonal aria-[current=page]:text-tonal-fg aria-[current=page]:shadow-none";

const hrefOf = (month: YearMonth, cardId?: string) =>
  ({ pathname: "/expenses", query: cardId ? { mes: month, cartao: cardId } : { mes: month } }) as const;

/** "2026-12" → "dez/26" */
const shortRef = (ym: string) => `${monthShort(ym)}/${ym.slice(2, 4)}`;

/** Onde a despesa cai: "6x de R$ 200,00 · dez/26 → mai/27" ou "À vista · fatura de dez/26". */
function scheduleLabel(e: ExpenseDTO): string {
  const first = e.schedule[0];
  const last = e.schedule.at(-1);
  if (!first || !last) return e.installments > 1 ? `${e.installments}x` : "À vista";
  if (e.installments === 1) return `À vista · fatura de ${shortRef(first.referenceMonth)}`;
  return `${e.installments}x de ${brl(last.amountCents)} · ${shortRef(first.referenceMonth)} → ${shortRef(last.referenceMonth)}`;
}

/**
 * Despesas (FLOW_MAP §1 e §7, RF-030 a RF-033): compras do mês por data, com filtro por cartão,
 * edição e exclusão. Assinaturas ficam na tela delas; aqui só o que foi comprado.
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; cartao?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const ctx = { db: prisma(), user, clock: systemClock };
  const params = await searchParams;
  const today = todayOf(ctx);
  const month: YearMonth = params.mes && isYearMonth(params.mes) ? params.mes : yearMonthOf(today);
  const cardId = params.cartao && Id.safeParse(params.cartao).success ? params.cartao : undefined;

  const [expenses, allCards, cardOptions, categories] = await Promise.all([
    listExpenses(ctx, { month }),
    listCards(ctx, { includeArchived: true }),
    listCardOptions(ctx),
    listCategories(ctx.db, user.id),
  ]);
  const cardName = new Map(allCards.map((c) => [c.id, c.nickname]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const lists = {
    cards: cardOptions,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    today,
  };

  // Chips só para cartões com despesa no mês (mais o filtrado, para poder voltar dele).
  const cardsInMonth = allCards.filter((c) => c.id === cardId || expenses.some((e) => e.cardId === c.id));
  const shown = cardId ? expenses.filter((e) => e.cardId === cardId) : expenses;
  const total = shown.reduce((sum, e) => sum + e.totalCents, 0);
  const installmentsInMonth = shown.filter((e) => e.installments > 1).length;
  const days = [...new Set(shown.map((e) => e.purchaseDate))];

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-heading-lg">Despesas</h1>
        <div className="flex flex-wrap items-center gap-3">
          <MonthNav month={month} label="Mês da compra" href={(m) => hrefOf(m, cardId)} />
          {cardOptions.length > 0 && <NewExpenseButton {...lists} className={button("primary", "md")} />}
        </div>
      </header>

      {cardOptions.length === 0 && expenses.length === 0 ? (
        <section className="rounded-xl bg-surface p-8 text-center shadow-hairline">
          <h2 className="font-display text-heading-sm">Crie um cartão primeiro</h2>
          <p className="mt-2 text-body text-fg-muted">
            Toda despesa é lançada na fatura de um cartão, à vista ou parcelada.
          </p>
          <NewCardButton className={`${button("primary", "md")} mt-6`}>Criar cartão</NewCardButton>
        </section>
      ) : (
        <>
          <section aria-labelledby="total" className="rounded-xl bg-surface p-6 shadow-hairline sm:p-8">
            <h2 id="total" className="text-body-sm text-fg-muted">
              Compras de {monthName(month)}
              {cardId && ` no ${cardName.get(cardId) ?? "cartão"}`}
            </h2>
            <p className="mt-1">
              <MoneyDisplay cents={total} size="display-sm" />
            </p>
            <p className="mt-2 text-body text-fg-muted">
              {shown.length === 1 ? "1 despesa" : `${shown.length} despesas`}
              {installmentsInMonth > 0 &&
                ` · ${installmentsInMonth === 1 ? "1 parcelada, contada" : `${installmentsInMonth} parceladas, contadas`} pelo valor cheio da compra`}
            </p>
          </section>

          {cardsInMonth.length > 1 && (
            <nav aria-label="Filtrar por cartão" className="flex flex-wrap gap-2">
              <Link href={hrefOf(month)} aria-current={!cardId ? "page" : undefined} className={CHIP}>
                Todos
                <span className="tabular-nums opacity-70">{expenses.length}</span>
              </Link>
              {cardsInMonth.map((c) => (
                <Link
                  key={c.id}
                  href={hrefOf(month, c.id)}
                  aria-current={c.id === cardId ? "page" : undefined}
                  className={CHIP}
                >
                  {c.nickname}
                  <span className="tabular-nums opacity-70">
                    {expenses.filter((e) => e.cardId === c.id).length}
                  </span>
                </Link>
              ))}
            </nav>
          )}

          {shown.length === 0 ? (
            <section className="rounded-xl bg-surface p-8 text-center shadow-hairline">
              <h2 className="font-display text-heading-sm">Nenhuma despesa em {monthName(month)}</h2>
              <p className="mt-2 text-body text-fg-muted">
                Lance compras à vista ou parceladas e veja em qual fatura cada parcela cai.
              </p>
              {cardOptions.length > 0 && (
                <NewExpenseButton {...lists} className={`${button("primary", "md")} mt-6`}>
                  Lançar despesa
                </NewExpenseButton>
              )}
            </section>
          ) : (
            <div className="flex flex-col gap-6">
              {days.map((day) => (
                <section
                  key={day}
                  aria-label={dayLabel(day as DateOnly, today)}
                  className="rounded-xl bg-surface px-5 py-4 shadow-hairline sm:px-6"
                >
                  <h2 className="text-overline text-fg-muted">{dayLabel(day as DateOnly, today)}</h2>
                  <ul className="mt-1">
                    {shown
                      .filter((e) => e.purchaseDate === day)
                      .map((e) => (
                        <li
                          key={e.id}
                          className="flex items-start gap-2 border-b border-border py-3 last:border-0"
                        >
                          <div className="min-w-0 flex-1 pt-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="truncate text-body text-fg">{e.description}</p>
                              <p className="shrink-0 text-body font-semibold text-fg tabular-nums">
                                {brl(e.totalCents)}
                              </p>
                            </div>
                            <p className="text-body-sm text-fg-muted tabular-nums">
                              {scheduleLabel(e)} · {cardName.get(e.cardId) ?? "Cartão"}
                              {e.categoryId && categoryName.has(e.categoryId)
                                ? ` · ${categoryName.get(e.categoryId)}`
                                : ""}
                            </p>
                          </div>
                          <div className="-mr-2 flex shrink-0 gap-1 sm:ml-4">
                            <EditExpenseButton expense={e} {...lists} />
                            <DeleteExpenseButton expense={e} />
                          </div>
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
