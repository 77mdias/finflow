import { FileText, Hourglass, Receipt, Repeat, type LucideIcon } from "lucide-react";

import type { DateOnly } from "@/shared/domain/date-only";
import { brl, dayLabel } from "@/shared/ui/format";

interface Event {
  date: DateOnly;
  type: "SUBSCRIPTION_CHARGE" | "INVOICE_CLOSING" | "INVOICE_DUE" | "TRIAL_ENDING";
  title: string;
  amountCents: number | null;
}

const TYPES: Record<Event["type"], { label: string; Icon: LucideIcon }> = {
  SUBSCRIPTION_CHARGE: { label: "Cobrança da assinatura", Icon: Repeat },
  INVOICE_CLOSING: { label: "Fechamento da fatura", Icon: FileText },
  INVOICE_DUE: { label: "Vencimento da fatura", Icon: Receipt },
  TRIAL_ENDING: { label: "Fim do período de teste", Icon: Hourglass },
};

/** RF-052: o que acontece nos próximos 14 dias, agrupado por dia. */
export function UpcomingList({ events, today }: { events: Event[]; today: DateOnly }) {
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
              .map((e, i) => {
                const { label, Icon } = TYPES[e.type];
                return (
                  <li
                    key={`${e.type}-${e.title}-${i}`}
                    className="flex min-h-14 items-center gap-3 border-b border-border last:border-0"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-subtle text-fg-muted">
                      <Icon aria-hidden size={16} strokeWidth={1.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-fg">{e.title}</span>
                      <span className="block text-body-sm text-fg-muted">{label}</span>
                    </span>
                    {e.amountCents !== null && (
                      <span className="text-body text-fg tabular-nums">{brl(e.amountCents)}</span>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
