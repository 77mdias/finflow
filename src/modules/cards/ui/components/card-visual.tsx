import { CreditCard } from "lucide-react";

import { cardGradient } from "@/shared/ui/card-colors";

export interface CardVisualProps {
  nickname: string;
  issuer: string | null;
  brand: string;
  last4: string | null;
  color: string;
  closingDay: number;
  dueDay: number;
}

/** "Nubank" → "NU", "Banco do Brasil" → "BD" (DESIGN §2.5 usa 2 letras). */
const initials = (issuer: string) => {
  const words = issuer.trim().split(/\s+/);
  return (words.length > 1 ? words[0]!.charAt(0) + words[1]!.charAt(0) : words[0]!.slice(0, 2)).toUpperCase();
};

/**
 * Cartão virtual (DESIGN §6.7): uma representação, nunca a arte de um cartão real. A bandeira
 * aparece só como texto e a instituição só como selo.
 */
export function CardVisual({ nickname, issuer, brand, last4, color, closingDay, dueDay }: CardVisualProps) {
  const g = cardGradient(color);
  const ink = g.dark ? "text-ink-800" : "text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]";
  return (
    <div
      className={`flex aspect-[1.586] w-full flex-col justify-between rounded-lg p-4 shadow-card ${ink}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* shortcut: selo com iniciais em branco translúcido; cores de referência (§2.5) e ícone enviado pelo usuário vêm com o cadastro de cartões. */}
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-md bg-white/20 text-[11px] font-semibold shadow-[0_0_0_1.5px_rgb(255_255_255/0.6)]"
          >
            {issuer ? initials(issuer) : <CreditCard size={16} strokeWidth={1.5} />}
          </span>
          <span className="truncate font-display text-heading-sm">{nickname}</span>
        </div>
        {brand !== "OTHER" && <span className="text-caption font-semibold opacity-85">{brand}</span>}
      </div>
      {last4 && (
        <p className="font-display text-body tracking-[0.2em] tabular-nums">
          <span aria-hidden>•••• </span>
          <span className="sr-only">final </span>
          {last4}
        </p>
      )}
      <p className="text-caption opacity-90">
        Fecha dia {closingDay} · Vence dia {dueDay}
      </p>
    </div>
  );
}
