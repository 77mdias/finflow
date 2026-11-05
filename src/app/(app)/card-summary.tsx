import type { Route } from "next";
import Link from "next/link";

import { CardVisual, type CardVisualProps } from "@/modules/cards/ui/components/card-visual";
import {
  InvoiceStatusBadge,
  type InvoiceBadgeStatus,
} from "@/modules/invoices/ui/components/invoice-status-badge";
import { brl, dayMonth, monthName } from "@/shared/ui/format";
import { MoneyDisplay } from "@/shared/ui/money-display";

export interface CardSummaryProps extends CardVisualProps {
  id: string;
  limitCents: number | null;
  usedLimitCents: number | null;
  currentInvoice: {
    referenceMonth: string;
    dueDate: string;
    status: InvoiceBadgeStatus;
    totalCents: number;
    projectedCents: number;
  };
}

/**
 * Cartão com a fatura atual e o uso do limite (DESIGN §7), no painel e em /cards. O card inteiro leva
 * à fatura: link no título + `::after` cobrindo (DESIGN §6.3).
 */
export function CardSummary({
  id,
  limitCents,
  usedLimitCents,
  currentInvoice: inv,
  ...card
}: CardSummaryProps) {
  const used = usedLimitCents ?? 0;
  const pct = limitCents ? Math.round((used / limitCents) * 100) : 0;
  // Calma antes de alarme: cor de atenção só perto do limite, e sempre com o número ao lado.
  const fill = pct >= 100 ? "bg-status-danger-fg" : pct >= 80 ? "bg-status-warning-fg" : "bg-primary";

  return (
    <article className="relative flex h-full flex-col gap-4 rounded-xl bg-surface p-4 shadow-hairline transition-shadow duration-200 hover:shadow-md sm:p-5">
      <CardVisual {...card} />
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-body-sm text-fg-muted">
            <Link
              href={`/cards/${id}/invoices/${inv.referenceMonth}` as Route}
              className="rounded-sm after:absolute after:inset-0 after:rounded-xl hover:text-fg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              Fatura de {monthName(inv.referenceMonth)}
              <span className="sr-only"> do {card.nickname}</span>
            </Link>
          </h3>
          <InvoiceStatusBadge status={inv.status} />
        </div>
        <p className="mt-1">
          <MoneyDisplay cents={inv.totalCents} size="heading" />
        </p>
        <p className="mt-1 text-body-sm text-fg-muted">
          Vence em {dayMonth(inv.dueDate)}
          {inv.projectedCents > 0 && <> · {brl(inv.projectedCents)} previsto</>}
        </p>
      </div>
      {limitCents !== null && limitCents > 0 && (
        <div>
          <div
            role="meter"
            aria-label={`Limite usado do ${card.nickname}`}
            aria-valuemin={0}
            aria-valuemax={limitCents}
            aria-valuenow={Math.min(used, limitCents)}
            aria-valuetext={`${brl(used)} de ${brl(limitCents)} (${pct}%)`}
            className="h-2 overflow-hidden rounded-full bg-surface-muted"
          >
            <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <p className="mt-1.5 flex justify-between gap-2 text-body-sm text-fg-muted tabular-nums">
            <span>
              {brl(used)} de {brl(limitCents)}
            </span>
            <span>{pct}%</span>
          </p>
        </div>
      )}
    </article>
  );
}
