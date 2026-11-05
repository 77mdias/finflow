import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUser } from "@/lib/session";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";
import { button } from "@/shared/ui/button";

import { UnarchiveCardButton } from "@/modules/cards/ui/components/archive-card";
import { NewCardButton } from "@/modules/cards/ui/components/card-form";
import { CardVisual } from "@/modules/cards/ui/components/card-visual";
import { getCardsOverview } from "@/modules/dashboard";

import { CardSummary } from "../card-summary";

export const metadata: Metadata = { title: "Cartões — FinFlow" };

/** Cartões (VISUAL_BRIEF §6 tela 5, FLOW_MAP §4): fatura atual e limite de cada um; arquivados no fim. */
export default async function CardsPage() {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const cards = await getCardsOverview({ db: prisma(), user, clock: systemClock });
  const active = cards.filter((c) => !c.archivedAt);
  const archived = cards.filter((c) => c.archivedAt);

  return (
    <div className="flex flex-col gap-8 lg:gap-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-heading-lg">Cartões</h1>
        {active.length > 0 && <NewCardButton className={button("primary", "md")} />}
      </header>

      {active.length === 0 ? (
        <section className="rounded-xl bg-surface p-8 text-center shadow-hairline">
          <h2 className="font-display text-heading-sm">Nenhum cartão ainda</h2>
          <p className="mt-2 text-body text-fg-muted">
            Crie seu primeiro cartão para começar a acompanhar suas faturas.
          </p>
          <NewCardButton className={`${button("primary", "md")} mt-6`}>Criar cartão</NewCardButton>
        </section>
      ) : (
        <ul aria-label="Cartões ativos" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((c) => (
            <li key={c.id} className="min-w-0">
              <CardSummary {...c} />
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section aria-labelledby="arquivados">
          <h2 id="arquivados" className="font-display text-heading-sm">
            Arquivados
          </h2>
          <p className="mt-1 text-body-sm text-fg-muted">
            Fora do painel e das projeções. As faturas continuam guardadas.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((c) => (
              <li
                key={c.id}
                className="flex min-w-0 flex-col gap-3 rounded-xl bg-surface p-4 shadow-hairline sm:p-5"
              >
                <CardVisual {...c} archived />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={`/cards/${c.id}/invoices/${c.currentInvoice.referenceMonth}` as Route}
                    className={button("ghost", "sm")}
                  >
                    Ver faturas<span className="sr-only"> do {c.nickname}</span>
                  </Link>
                  <UnarchiveCardButton id={c.id} nickname={c.nickname} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
