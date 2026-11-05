import { ChevronLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { currentUser } from "@/lib/session";
import { todayOf } from "@/shared/application/context";
import { Id } from "@/shared/application/schemas";
import { isAppError } from "@/shared/domain/errors";
import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";
import { button } from "@/shared/ui/button";
import { brl, fullDate } from "@/shared/ui/format";
import { MoneyDisplay } from "@/shared/ui/money-display";

import { listCardOptions } from "@/modules/cards";
import { listCategories } from "@/modules/categories";
import { getSubscription } from "@/modules/subscriptions";
import {
  CancelSubscriptionButton,
  ChangeCardButton,
  ChangePriceButton,
  DeleteSubscriptionButton,
  DuplicateButton,
  PauseButton,
  ResumeButton,
} from "@/modules/subscriptions/ui/components/subscription-actions";
import {
  CYCLES,
  ServiceAvatar,
  SubscriptionStatusBadge,
} from "@/modules/subscriptions/ui/components/subscription-bits";
import { nextEvent } from "@/modules/subscriptions/ui/components/subscription-card";
import { EditSubscriptionButton } from "@/modules/subscriptions/ui/components/subscription-form";

export const metadata: Metadata = { title: "Assinatura — FinFlow" };

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl bg-surface p-5 shadow-hairline sm:p-6">
      <h2 className="font-display text-heading-sm">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const ROW =
  "grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2 last:border-b-0";

/** Assinatura (FLOW_MAP §1 `/subscriptions/[id]`, §6): valor, próxima cobrança, ciclo de vida e histórico. */
export default async function SubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  const { id } = await params;
  if (!Id.safeParse(id).success) notFound();
  const ctx = { db: prisma(), user, clock: systemClock };
  const [sub, cards, categories] = await Promise.all([
    getSubscription(ctx, id),
    listCardOptions(ctx),
    listCategories(ctx.db, user.id),
  ]).catch((e: unknown) => {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const today = todayOf(ctx);
  const [eventLabel, eventValue] = nextEvent(sub, today);
  const editable = sub.status !== "CANCELED";
  // Preço vigente: o último com início até hoje; os seguintes são mudanças agendadas.
  const prices = [...sub.priceHistory].reverse();
  const current = prices.find((p) => p.effectiveFrom <= today);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Link
          href="/subscriptions"
          className="-ml-1 inline-flex items-center gap-1 rounded-md text-body-sm text-fg-muted hover:text-fg"
        >
          <ChevronLeft aria-hidden size={16} strokeWidth={1.5} />
          Assinaturas
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <ServiceAvatar name={sub.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="truncate font-display text-heading-lg">{sub.name}</h1>
                <SubscriptionStatusBadge status={sub.status} />
              </div>
              <p className="text-body-sm text-fg-muted">{sub.category?.name ?? "Sem categoria"}</p>
            </div>
          </div>
          {editable && (
            <div className="flex flex-wrap items-start gap-2">
              <EditSubscriptionButton
                sub={{
                  id: sub.id,
                  updatedAt: sub.updatedAt,
                  name: sub.name,
                  status: sub.status,
                  cycle: sub.cycle,
                  nextChargeDate: sub.nextChargeDate,
                  categoryId: sub.category?.id ?? null,
                  manageUrl: sub.manageUrl,
                  notes: sub.notes,
                }}
                categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                today={today}
              />
              {sub.status === "ACTIVE" && <PauseButton id={sub.id} name={sub.name} />}
              {sub.status === "PAUSED" && <ResumeButton id={sub.id} name={sub.name} today={today} />}
            </div>
          )}
        </div>
      </header>

      <section aria-labelledby="valor" className="rounded-xl bg-surface p-6 shadow-hairline sm:p-10">
        <h2 id="valor" className="text-body-sm text-fg-muted">
          Valor {CYCLES[sub.cycle].label.toLowerCase()}
        </h2>
        <p className="mt-2 flex items-baseline gap-1.5">
          <MoneyDisplay cents={sub.amountCents} size="display-sm" />
          <span className="text-body text-fg-muted">/{CYCLES[sub.cycle].per}</span>
        </p>
        <p className="mt-2 text-body-sm text-fg-muted tabular-nums">
          {sub.cycle !== "MONTHLY" && `≈ ${brl(sub.monthlyEquivalentCents)} por mês · `}
          {brl(sub.yearlyEquivalentCents)} por ano
        </p>
        <dl className="mt-6 grid gap-x-6 gap-y-2 text-body-sm sm:flex sm:flex-wrap">
          <div className="flex gap-1.5">
            <dt className="text-fg-muted">{eventLabel}</dt>
            <dd className="tabular-nums">{eventValue}</dd>
          </div>
          {sub.status === "TRIAL" && sub.nextChargeDate && (
            <div className="flex gap-1.5">
              <dt className="text-fg-muted">Primeira cobrança</dt>
              <dd className="tabular-nums">{fullDate(sub.nextChargeDate)}</dd>
            </div>
          )}
          <div className="flex gap-1.5">
            <dt className="text-fg-muted">Cartão</dt>
            <dd>{sub.card.nickname}</dd>
          </div>
        </dl>
        {(editable || sub.manageUrl) && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-6">
            {editable && <ChangePriceButton id={sub.id} amountCents={sub.amountCents} today={today} />}
            {editable && cards.some((c) => c.id !== sub.card.id) && (
              <ChangeCardButton id={sub.id} cardId={sub.card.id} cards={cards} />
            )}
            {sub.manageUrl && (
              <a
                href={sub.manageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={button("ghost", "sm")}
              >
                <ExternalLink aria-hidden size={16} strokeWidth={1.5} />
                Gerenciar no serviço
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Últimas cobranças">
          {sub.recentCharges.length === 0 ? (
            <p className="text-body text-fg-muted">Nenhuma cobrança lançada ainda.</p>
          ) : (
            <ul>
              {sub.recentCharges.map((c) => (
                <li key={c.id} className={ROW}>
                  <span className="text-body tabular-nums">{fullDate(c.chargeDate)}</span>
                  <span className="text-body tabular-nums">{brl(c.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Histórico de valor">
          <ul>
            {prices.map((p) => (
              <li key={p.effectiveFrom} className={ROW}>
                <span className="text-body">
                  A partir de <span className="tabular-nums">{fullDate(p.effectiveFrom)}</span>
                  {p === current && <span className="text-fg-muted"> · atual</span>}
                  {p.effectiveFrom > today && <span className="text-fg-muted"> · agendado</span>}
                </span>
                <span className="text-body tabular-nums">{brl(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {sub.notes && (
        <Panel title="Observações">
          <p className="text-body whitespace-pre-line">{sub.notes}</p>
        </Panel>
      )}

      <section aria-label="Mais ações" className="flex flex-wrap gap-2 border-t border-border pt-6">
        <DuplicateButton id={sub.id} name={sub.name} />
        {editable && (
          <CancelSubscriptionButton id={sub.id} name={sub.name} today={today} manageUrl={sub.manageUrl} />
        )}
        {/* Com cobrança lançada, excluir apagaria o histórico das faturas: o caminho é cancelar. */}
        {sub.recentCharges.length === 0 && <DeleteSubscriptionButton id={sub.id} name={sub.name} />}
      </section>
    </div>
  );
}
