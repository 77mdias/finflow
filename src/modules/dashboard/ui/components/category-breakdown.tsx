import { brl } from "@/shared/ui/format";

interface Item {
  category: { name: string } | null;
  totalCents: number;
}

const SHOWN = 7;
const GAP_DEG = 1.5;

/** Até 7 categorias + "Outros" (DESIGN §2.4), na ordem de valor, que já vem do backend. */
export function groupCategories(items: Item[]): { name: string; totalCents: number; color: string }[] {
  const rows = items.filter((i) => i.totalCents > 0);
  const top = rows.slice(0, SHOWN).map((i, idx) => ({
    name: i.category?.name ?? "Sem categoria",
    totalCents: i.totalCents,
    color: `var(--chart-cat-${idx + 1})`,
  }));
  const rest = rows.slice(SHOWN).reduce((s, i) => s + i.totalCents, 0);
  return rest > 0 ? [...top, { name: "Outros", totalCents: rest, color: "var(--chart-cat-other)" }] : top;
}

/** RF-054: gasto do mês por categoria, em rosca + lista (a lista é a leitura acessível). */
export function CategoryBreakdown({ items }: { items: Item[] }) {
  const rows = groupCategories(items);
  const total = rows.reduce((s, r) => s + r.totalCents, 0);
  if (total === 0) {
    return <p className="text-body text-fg-muted">Nenhum gasto lançado neste mês ainda.</p>;
  }

  // Fatias com 1,5° de respiro na cor da superfície entre elas (mark spec: 2 px entre preenchimentos).
  const gap = rows.length > 1 ? GAP_DEG : 0;
  const endDeg = (i: number) => (rows.slice(0, i + 1).reduce((s, r) => s + r.totalCents, 0) / total) * 360;
  const stops = rows.flatMap((r, i) => {
    const start = i === 0 ? 0 : endDeg(i - 1);
    const end = endDeg(i);
    return [
      `${r.color} ${start + gap / 2}deg ${end - gap / 2}deg`,
      `var(--surface) ${end - gap / 2}deg ${end}deg`,
    ];
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start lg:flex-col lg:items-center xl:flex-row xl:items-start">
      <div
        aria-hidden
        className="relative size-40 shrink-0 rounded-full"
        style={{ backgroundImage: `conic-gradient(${stops.join(", ")})` }}
      >
        <div className="absolute inset-[22px] grid place-items-center rounded-full bg-surface text-center">
          <span>
            <span className="block text-caption text-fg-muted">Total</span>
            <span className="font-display text-body font-semibold tabular-nums">{brl(total)}</span>
          </span>
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-col">
        {rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center gap-3 border-b border-border py-2.5 text-body-sm last:border-0"
          >
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: r.color }} />
            <span className="min-w-0 flex-1 truncate text-fg">{r.name}</span>
            <span className="text-fg-muted tabular-nums">{Math.round((r.totalCents / total) * 100)}%</span>
            <span className="w-24 text-right text-fg tabular-nums">{brl(r.totalCents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
