import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

import { addYearMonths, type YearMonth } from "@/shared/domain/date-only";
import { monthLabel } from "@/shared/ui/format";

/** Segmented ◀ mês ▶ (DESIGN §6.5), usado no painel e na fatura. */
export function MonthNav({
  month,
  href,
  label = "Mês",
}: {
  month: YearMonth;
  href: (m: YearMonth) => ComponentProps<typeof Link>["href"];
  label?: string;
}) {
  const prev = addYearMonths(month, -1);
  const next = addYearMonths(month, 1);
  const arrow = "grid size-8 place-items-center rounded-full text-fg-muted hover:bg-surface hover:text-fg";
  return (
    <nav aria-label={label} className="flex items-center gap-1 rounded-full bg-surface-subtle p-1 text-label">
      <Link href={href(prev)} aria-label={`Ver ${monthLabel(prev)}`} className={arrow}>
        <ChevronLeft aria-hidden size={18} strokeWidth={1.5} />
      </Link>
      <span aria-live="polite" className="min-w-36 rounded-full bg-surface px-3 py-1.5 text-center shadow-sm">
        {monthLabel(month)}
      </span>
      <Link href={href(next)} aria-label={`Ver ${monthLabel(next)}`} className={arrow}>
        <ChevronRight aria-hidden size={18} strokeWidth={1.5} />
      </Link>
    </nav>
  );
}
