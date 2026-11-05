import { CreditCard } from "lucide-react";

import { cardGradient } from "@/shared/ui/card-colors";

import { institutionBadge } from "../institutions";

export interface CardVisualProps {
  nickname: string;
  issuer: string | null;
  brand: string;
  last4: string | null;
  color: string;
  /** Texto livre aceito para a pré-visualização do formulário ("–" antes de preencher). */
  closingDay: number | string;
  dueDay: number | string;
  archived?: boolean;
}

/**
 * Selo da instituição sobre o cartão (DESIGN §6.7): iniciais na cor de referência (§2.5) com anel
 * branco, ou ícone genérico de cartão. shortcut: sem ícone enviado pelo usuário até existir upload.
 */
function InstitutionBadge({ issuer, size }: { issuer: string | null; size: "sm" | "md" }) {
  const box = size === "md" ? "size-7 text-[11px]" : "size-5 text-[8px]";
  const badge = issuer?.trim() ? institutionBadge(issuer) : null;
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-md font-semibold shadow-[0_0_0_1.5px_rgb(255_255_255/0.6)] ${box} ${
        badge ? (badge.dark ? "text-ink-800" : "text-white") : "bg-white/20"
      }`}
      style={badge ? { backgroundColor: badge.color, textShadow: "none" } : undefined}
    >
      {badge ? badge.initials : <CreditCard size={size === "md" ? 16 : 12} strokeWidth={1.5} />}
    </span>
  );
}

/**
 * Cartão virtual (DESIGN §6.7): uma representação, nunca a arte de um cartão real. A bandeira
 * aparece só como texto e a instituição só como selo. Arquivado: cinza e 60% de opacidade.
 */
export function CardVisual({
  nickname,
  issuer,
  brand,
  last4,
  color,
  closingDay,
  dueDay,
  archived,
}: CardVisualProps) {
  const g = cardGradient(color);
  const ink = g.dark ? "text-ink-800" : "text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]";
  return (
    <div
      className={`flex aspect-[1.586] w-full flex-col justify-between rounded-lg p-4 shadow-card ${ink} ${
        archived ? "opacity-60 grayscale" : ""
      }`}
      style={{ backgroundImage: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <InstitutionBadge issuer={issuer} size="md" />
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

/** Miniatura do cartão (cabeçalho da fatura): só cor e selo, decorativa. */
export function CardThumb({
  issuer,
  color,
  archived,
}: Pick<CardVisualProps, "issuer" | "color" | "archived">) {
  const g = cardGradient(color);
  return (
    <span
      aria-hidden
      className={`flex aspect-[1.586] w-14 shrink-0 items-start rounded-sm p-1.5 shadow-sm ${
        archived ? "opacity-60 grayscale" : ""
      }`}
      style={{ backgroundImage: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
    >
      <InstitutionBadge issuer={issuer} size="sm" />
    </span>
  );
}
