import { Repeat, ShoppingBag, SlidersHorizontal } from "lucide-react";

import { brl } from "@/shared/ui/format";

const ICON = { SUBSCRIPTION: Repeat, INSTALLMENT: ShoppingBag, ADJUSTMENT: SlidersHorizontal } as const;

export interface ChargeRowProps {
  description: string;
  sourceType: keyof typeof ICON;
  projected: boolean;
  amountCents: number;
  category: string | null;
}

/**
 * Linha de cobrança (DESIGN §6.8): `[ícone] [descrição + meta] [valor]`. Previsto ≠ confirmado: ícone
 * tracejado, valor em `--fg-muted` e o rótulo "previsto" escrito. Ajuste negativo em verde com "−".
 */
export function ChargeRow({ description, sourceType, projected, amountCents, category }: ChargeRowProps) {
  const Icon = ICON[sourceType];
  // A parcela ("2/3") já vem na descrição gerada pelo módulo de despesas.
  const meta = [category, projected && "previsto"].filter(Boolean).join(" · ");
  const credit = amountCents < 0;
  return (
    <li className="grid min-h-14 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2 last:border-b-0">
      <span
        aria-hidden
        className={`grid size-8 place-items-center rounded-full ${
          projected ? "border border-dashed border-border-strong text-fg-muted" : "bg-surface-subtle text-fg"
        }`}
      >
        <Icon size={16} strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-body">{description}</p>
        {meta && <p className="text-body-sm text-fg-muted">{meta}</p>}
      </div>
      <span
        className={`text-body tabular-nums ${
          projected ? "text-fg-muted" : credit ? "text-status-positive-fg" : "text-fg"
        }`}
      >
        {credit ? `− ${brl(-amountCents)}` : brl(amountCents)}
      </span>
    </li>
  );
}
