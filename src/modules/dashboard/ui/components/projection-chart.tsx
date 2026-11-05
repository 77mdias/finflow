import type { CSSProperties } from "react";

import { cardGradient } from "@/shared/ui/card-colors";
import { brl, monthLabel, monthShort } from "@/shared/ui/format";

interface Month {
  referenceMonth: string;
  totalCents: number;
  byCard: { cardId: string; totalCents: number; projectedCents: number }[];
}
interface Card {
  id: string;
  nickname: string;
  color: string;
}

const COMPACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Topo "redondo" do eixo: 1, 2, 2,5 ou 5 × 10ⁿ acima do maior valor. */
export function niceCeil(value: number): number {
  if (value <= 0) return 100;
  const step = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].map((m) => m * step).find((v) => v >= value)!;
}

/** Previsto = cor do cartão a 45% + hachura de 1 px (DESIGN §2.4: nunca só a opacidade). */
const projectedFill = (color: string): CSSProperties => ({
  backgroundColor: `color-mix(in srgb, ${color} 45%, transparent)`,
  backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 1px, transparent 1px 5px)`,
});

/** RF-055 / US12: fatura projetada dos próximos 12 meses, empilhada por cartão. */
export function ProjectionChart({ months, cards }: { months: Month[]; cards: Card[] }) {
  const max = niceCeil(Math.max(0, ...months.map((m) => m.totalCents)));
  const color = (cardId: string) => cardGradient(cards.find((c) => c.id === cardId)?.color ?? "violet").from;
  const name = (cardId: string) => cards.find((c) => c.id === cardId)?.nickname ?? "Cartão";
  // Cartões sempre na mesma ordem de baixo para cima: a cor segue o cartão, não o valor.
  const ordered = (m: Month) =>
    cards.flatMap((c) => m.byCard.filter((b) => b.cardId === c.id && b.totalCents > 0));

  if (months.every((m) => m.totalCents === 0)) {
    return <p className="text-body text-fg-muted">Nenhuma cobrança prevista para os próximos meses.</p>;
  }

  return (
    <figure>
      <div aria-hidden className="relative h-52 pl-14">
        {[0, max / 2, max].map((t) => (
          <div
            key={t}
            className="absolute inset-x-0 border-t border-dashed border-border-strong"
            style={{ bottom: `${(t / max) * 100}%` }}
          >
            <span className="absolute -top-2 left-0 text-caption text-fg-muted tabular-nums">
              {COMPACT.format(t / 100)}
            </span>
          </div>
        ))}
        <div className="relative flex h-full items-end gap-1 sm:gap-2">
          {months.map((m, i) => (
            <div
              key={m.referenceMonth}
              className="group relative flex h-full flex-1 items-end justify-center"
            >
              <div
                className="flex w-full max-w-7 flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px]"
                style={{ height: `${(m.totalCents / max) * 100}%` }}
              >
                {ordered(m).flatMap((b) => {
                  const c = color(b.cardId);
                  const launched = b.totalCents - b.projectedCents;
                  return [
                    launched > 0 && (
                      <div key={`${b.cardId}-l`} style={{ flexGrow: launched, backgroundColor: c }} />
                    ),
                    b.projectedCents > 0 && (
                      <div
                        key={`${b.cardId}-p`}
                        style={{ flexGrow: b.projectedCents, ...projectedFill(c) }}
                      />
                    ),
                  ];
                })}
              </div>
              <div
                className={`pointer-events-none absolute top-0 z-10 hidden w-max min-w-48 rounded-md bg-surface p-3 text-body-sm shadow-md group-hover:block ${
                  i < 2 ? "left-0" : i > months.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
                }`}
              >
                <p className="font-semibold text-fg">{monthLabel(m.referenceMonth)}</p>
                <p className="mt-0.5 text-fg tabular-nums">{brl(m.totalCents)}</p>
                <ul className="mt-2 flex flex-col gap-1 text-fg-muted">
                  {ordered(m).map((b) => (
                    <li key={b.cardId} className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: color(b.cardId) }} />
                      <span className="flex-1 whitespace-nowrap">{name(b.cardId)}</span>
                      <span className="tabular-nums">{brl(b.totalCents)}</span>
                    </li>
                  ))}
                </ul>
                {m.byCard.some((b) => b.projectedCents > 0) && (
                  <p className="mt-2 text-caption text-fg-muted">
                    Previsto: {brl(m.byCard.reduce((s, b) => s + b.projectedCents, 0))}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden className="mt-2 flex gap-1 pl-14 sm:gap-2">
        {months.map((m, i) => (
          <span key={m.referenceMonth} className="flex-1 text-center text-caption text-fg-muted">
            {monthShort(m.referenceMonth)}
            {(i === 0 || m.referenceMonth.endsWith("-01")) && (
              <span className="block opacity-70">{m.referenceMonth.slice(2, 4)}</span>
            )}
          </span>
        ))}
      </div>

      <figcaption className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-body-sm text-fg-muted">
        {cards.length > 1 &&
          cards.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: cardGradient(c.color).from }} />
              {c.nickname}
            </span>
          ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={projectedFill("var(--color-iris-500)")} />
          Previsto (assinaturas ainda não lançadas)
        </span>
      </figcaption>

      <details className="mt-4">
        <summary className="cursor-pointer text-body-sm font-medium text-primary">Ver em tabela</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-body-sm tabular-nums">
            <thead className="text-fg">
              <tr className="border-b border-border-strong">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Fatura
                </th>
                {cards.map((c) => (
                  <th key={c.id} scope="col" className="py-2 pr-3 text-right font-semibold">
                    {c.nickname}
                  </th>
                ))}
                <th scope="col" className="py-2 text-right font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="text-fg-muted">
              {months.map((m) => (
                <tr key={m.referenceMonth} className="border-b border-border">
                  <th scope="row" className="py-2 pr-3 font-normal text-fg">
                    {monthLabel(m.referenceMonth)}
                  </th>
                  {cards.map((c) => {
                    const b = m.byCard.find((x) => x.cardId === c.id);
                    return (
                      <td key={c.id} className="py-2 pr-3 text-right">
                        {brl(b?.totalCents ?? 0)}
                        {b && b.projectedCents > 0 && (
                          <span className="block text-caption">previsto {brl(b.projectedCents)}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 text-right text-fg">{brl(m.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
