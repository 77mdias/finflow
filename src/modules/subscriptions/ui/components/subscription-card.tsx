import type { Route } from "next";
import Link from "next/link";

import type { DateOnly } from "@/shared/domain/date-only";
import { cardGradient } from "@/shared/ui/card-colors";
import { brl, dayLabel, dayMonth } from "@/shared/ui/format";
import { MoneyDisplay } from "@/shared/ui/money-display";

import type { SubscriptionDTO } from "../../application/queries";
import { CYCLES, ServiceAvatar, SubscriptionStatusBadge } from "./subscription-bits";

/** "Próxima cobrança · Amanhã", "Fim do teste · …", "Cancelada em · 05/11". */
export function nextEvent(s: SubscriptionDTO, today: DateOnly): [string, string] {
  if (s.status === "TRIAL" && s.trialEndsOn)
    return ["Fim do teste", dayLabel(s.trialEndsOn as DateOnly, today)];
  if (s.status === "PAUSED") return ["Próxima cobrança", "Ao retomar"];
  if (s.status === "CANCELED" && s.canceledOn)
    return [s.canceledOn > today ? "Cancela em" : "Cancelada em", dayMonth(s.canceledOn)];
  return ["Próxima cobrança", s.nextChargeDate ? dayLabel(s.nextChargeDate as DateOnly, today) : "—"];
}

/**
 * Card de assinatura (DESIGN §7): avatar, valor com o ciclo, próxima cobrança e cartão. O nome é um
 * link esticado sobre o card inteiro.
 */
export function SubscriptionCard({ sub, today }: { sub: SubscriptionDTO; today: DateOnly }) {
  const [eventLabel, eventValue] = nextEvent(sub, today);
  return (
    <article className="relative flex h-full flex-col gap-4 rounded-xl bg-surface p-5 shadow-hairline transition-shadow duration-150 hover:shadow-md">
      <div className="flex items-start gap-3">
        <ServiceAvatar name={sub.name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-body font-semibold">
            <Link
              href={`/subscriptions/${sub.id}` as Route}
              className="rounded-sm after:absolute after:inset-0 after:rounded-xl"
            >
              {sub.name}
            </Link>
          </h3>
          <p className="truncate text-body-sm text-fg-muted">{sub.category?.name ?? "Sem categoria"}</p>
        </div>
        <SubscriptionStatusBadge status={sub.status} />
      </div>

      <div>
        <p className="flex items-baseline gap-1">
          <MoneyDisplay cents={sub.amountCents} size="heading" />
          <span className="text-body-sm text-fg-muted">/{CYCLES[sub.cycle].per}</span>
        </p>
        {sub.cycle !== "MONTHLY" && (
          <p className="text-body-sm text-fg-muted tabular-nums">
            ≈ {brl(sub.monthlyEquivalentCents)} por mês
          </p>
        )}
      </div>

      <dl className="mt-auto flex flex-col gap-1 border-t border-border pt-3 text-body-sm">
        {/* Sem espaço, a data desce inteira para a linha de baixo em vez de quebrar no meio. */}
        <div className="flex flex-wrap justify-between gap-x-3 whitespace-nowrap">
          <dt className="text-fg-muted">{eventLabel}</dt>
          <dd className="tabular-nums">{eventValue}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-fg-muted">Cartão</dt>
          <dd className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: cardGradient(sub.card.color).from }}
            />
            <span className="truncate">{sub.card.nickname}</span>
          </dd>
        </div>
      </dl>
    </article>
  );
}
