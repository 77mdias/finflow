import { FileText, Hourglass, Receipt, Repeat, ShoppingBag, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type { DateOnly } from "@/shared/domain/date-only";
import { brl, dayLabel } from "@/shared/ui/format";

import type { CalendarEventDTO } from "../../application/dashboard";

export const EVENT_TYPES: Record<CalendarEventDTO["type"], { label: string; Icon: LucideIcon }> = {
  SUBSCRIPTION_CHARGE: { label: "Cobrança da assinatura", Icon: Repeat },
  INSTALLMENT: { label: "Despesa no cartão", Icon: ShoppingBag },
  INVOICE_CLOSING: { label: "Fechamento da fatura", Icon: FileText },
  INVOICE_DUE: { label: "Vencimento da fatura", Icon: Receipt },
  TRIAL_ENDING: { label: "Fim do período de teste", Icon: Hourglass },
};

/** Uma linha de evento (cobrança, fechamento, vencimento, fim de teste), usada no painel e no calendário. */
export function EventRow({ event }: { event: CalendarEventDTO }) {
  const { label, Icon } = EVENT_TYPES[event.type];
  return (
    <li className="border-b border-border last:border-0">
      <Link
        href={event.href as Route}
        className="-mx-2 flex min-h-14 items-center gap-3 rounded-md px-2 transition-colors duration-150 hover:bg-surface-subtle"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-subtle text-fg-muted">
          <Icon aria-hidden size={16} strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-fg">{event.title}</span>
          <span className="block text-body-sm text-fg-muted">
            {label}
            {event.projected && " · prevista"}
          </span>
        </span>
        {event.amountCents !== null && (
          <span className={`text-body tabular-nums ${event.projected ? "text-fg-muted" : "text-fg"}`}>
            {brl(event.amountCents)}
          </span>
        )}
      </Link>
    </li>
  );
}

/** RF-052: o que acontece nos próximos 14 dias, agrupado por dia. */
export function UpcomingList({ events, today }: { events: CalendarEventDTO[]; today: DateOnly }) {
  if (events.length === 0) {
    return <p className="text-body text-fg-muted">Nada previsto para os próximos 14 dias.</p>;
  }
  const days = [...new Set(events.map((e) => e.date))];
  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => (
        <section key={day} aria-label={dayLabel(day, today)}>
          <h3 className="text-overline text-fg-muted">{dayLabel(day, today)}</h3>
          <ul className="mt-1">
            {events
              .filter((e) => e.date === day)
              .map((e, i) => (
                <EventRow key={`${e.type}-${e.href}-${i}`} event={e} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
