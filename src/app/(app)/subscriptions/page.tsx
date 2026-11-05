import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUser } from "@/lib/session";
import { todayOf } from "@/shared/application/context";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";
import { button } from "@/shared/ui/button";
import { brl } from "@/shared/ui/format";
import { MoneyDisplay } from "@/shared/ui/money-display";

import { listCardOptions } from "@/modules/cards";
import { NewCardButton } from "@/modules/cards/ui/components/card-form";
import { listCategories } from "@/modules/categories";
import { listSubscriptions, type SubscriptionDTO } from "@/modules/subscriptions";
import { SubscriptionCard } from "@/modules/subscriptions/ui/components/subscription-card";
import { NewSubscriptionButton } from "@/modules/subscriptions/ui/components/subscription-form";

export const metadata: Metadata = { title: "Assinaturas — FinFlow" };

const FILTERS = [
  { value: "ALL", label: "Todas" },
  { value: "ACTIVE", label: "Ativas" },
  { value: "TRIAL", label: "Em teste" },
  { value: "PAUSED", label: "Pausadas" },
] as const;

/** Ordem em memória: "valor" é o custo mensal equivalente, para comparar ciclos diferentes. */
const SORTS = {
  next: {
    label: "Próxima",
    by: (a: SubscriptionDTO, b: SubscriptionDTO) =>
      (a.nextChargeDate ?? "9999").localeCompare(b.nextChargeDate ?? "9999"),
  },
  amount: {
    label: "Valor",
    by: (a: SubscriptionDTO, b: SubscriptionDTO) => b.monthlyEquivalentCents - a.monthlyEquivalentCents,
  },
  name: {
    label: "Nome",
    by: (a: SubscriptionDTO, b: SubscriptionDTO) => a.name.localeCompare(b.name, "pt-BR"),
  },
} as const;
type Sort = keyof typeof SORTS;

const hrefOf = (status: string, sort: Sort) => {
  const q = new URLSearchParams();
  if (status !== "ALL") q.set("status", status);
  if (sort !== "next") q.set("sort", sort);
  return `/subscriptions${q.size ? `?${q}` : ""}` as Route;
};

const CHIP =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-label transition-colors duration-150 " +
  "text-fg-muted shadow-[inset_0_0_0_1px_var(--border-strong)] hover:bg-surface-subtle hover:text-fg " +
  "aria-[current=page]:bg-tonal aria-[current=page]:text-tonal-fg aria-[current=page]:shadow-none";

/**
 * Assinaturas (VISUAL_BRIEF §6 tela 3, DESIGN §7): custo mensal e anual, filtros em chips e um card por
 * assinatura. Canceladas ficam numa seção no fim, como os cartões arquivados.
 * shortcut: filtros por cartão e por categoria (RF-025) ficam para quando a lista crescer.
 */
export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const ctx = { db: prisma(), user, clock: systemClock };
  const [subs, cards, categories, params] = await Promise.all([
    listSubscriptions(ctx),
    listCardOptions(ctx),
    listCategories(ctx.db, user.id),
    searchParams,
  ]);
  const today = todayOf(ctx);
  const status = FILTERS.find((f) => f.value === params.status)?.value ?? "ALL";
  const sort: Sort = params.sort && params.sort in SORTS ? (params.sort as Sort) : "next";

  const live = subs.filter((s) => s.status !== "CANCELED");
  const canceled = subs
    .filter((s) => s.status === "CANCELED")
    .sort((a, b) => (b.canceledOn ?? "").localeCompare(a.canceledOn ?? ""));
  // RF-051: ativas + em teste (o teste vira cobrança no fim).
  const charging = live.filter((s) => s.status !== "PAUSED");
  const monthly = charging.reduce((sum, s) => sum + s.monthlyEquivalentCents, 0);
  const yearly = charging.reduce((sum, s) => sum + s.yearlyEquivalentCents, 0);
  const count = (value: string) =>
    value === "ALL" ? live.length : live.filter((s) => s.status === value).length;
  const shown = live.filter((s) => status === "ALL" || s.status === status).sort(SORTS[sort].by);

  const lists = {
    cards,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    today,
  };

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-heading-lg">Assinaturas</h1>
        {cards.length > 0 && subs.length > 0 && (
          <NewSubscriptionButton {...lists} className={button("primary", "md")} />
        )}
      </header>

      {cards.length === 0 && subs.length === 0 ? (
        <section className="rounded-xl bg-surface p-8 text-center shadow-hairline">
          <h2 className="font-display text-heading-sm">Crie um cartão primeiro</h2>
          <p className="mt-2 text-body text-fg-muted">
            Toda assinatura é cobrada em um cartão. Depois é só adicionar as assinaturas dele.
          </p>
          <NewCardButton className={`${button("primary", "md")} mt-6`}>Criar cartão</NewCardButton>
        </section>
      ) : subs.length === 0 ? (
        <section className="rounded-xl bg-surface p-8 text-center shadow-hairline">
          <h2 className="font-display text-heading-sm">Nenhuma assinatura ainda</h2>
          <p className="mt-2 text-body text-fg-muted">
            Adicione streaming, apps e serviços para ver quanto eles custam por mês e quando cobram.
          </p>
          <NewSubscriptionButton {...lists} className={`${button("primary", "md")} mt-6`}>
            Adicionar assinatura
          </NewSubscriptionButton>
        </section>
      ) : (
        <>
          <section aria-labelledby="custo" className="rounded-xl bg-surface p-6 shadow-hairline sm:p-8">
            <h2 id="custo" className="text-body-sm text-fg-muted">
              Custo mensal
            </h2>
            <p className="mt-1">
              <MoneyDisplay cents={monthly} size="display-sm" />
            </p>
            <p className="mt-2 text-body text-fg-muted">
              <strong className="font-semibold text-fg tabular-nums">{brl(yearly)}</strong> por ano ·{" "}
              {charging.length === 1 ? "1 assinatura cobrando" : `${charging.length} assinaturas cobrando`}
            </p>
          </section>

          {live.length > 0 && (
            <section aria-label="Assinaturas em uso" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <nav aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
                  {FILTERS.filter((f) => f.value === "ALL" || count(f.value) > 0).map((f) => (
                    <Link
                      key={f.value}
                      href={hrefOf(f.value, sort)}
                      aria-current={f.value === status ? "page" : undefined}
                      className={CHIP}
                    >
                      {f.label}
                      <span className="tabular-nums opacity-70">{count(f.value)}</span>
                    </Link>
                  ))}
                </nav>
                <nav
                  aria-label="Ordenar por"
                  className="inline-flex rounded-full bg-surface-subtle p-1 text-label"
                >
                  {(Object.keys(SORTS) as Sort[]).map((s) => (
                    <Link
                      key={s}
                      href={hrefOf(status, s)}
                      aria-current={s === sort ? "page" : undefined}
                      className="rounded-full px-3 py-1 text-fg-muted hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:text-fg aria-[current=page]:shadow-sm"
                    >
                      {SORTS[s].label}
                    </Link>
                  ))}
                </nav>
              </div>

              {shown.length === 0 ? (
                <p className="text-body text-fg-muted">Nenhuma assinatura neste filtro.</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((s) => (
                    <li key={s.id} className="min-w-0">
                      <SubscriptionCard sub={s} today={today} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {canceled.length > 0 && (
            <section aria-labelledby="canceladas">
              <h2 id="canceladas" className="font-display text-heading-sm">
                Canceladas
              </h2>
              <p className="mt-1 text-body-sm text-fg-muted">
                Fora do custo mensal. Dá para duplicar se você assinar de novo.
              </p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {canceled.map((s) => (
                  <li key={s.id} className="min-w-0">
                    <SubscriptionCard sub={s} today={today} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
