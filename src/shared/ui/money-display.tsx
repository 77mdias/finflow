import { BRL } from "./format";

const SIZES = {
  display: "text-display",
  "display-sm": "text-display-sm",
  "heading-lg": "text-heading-lg",
  heading: "text-heading",
} as const;

/** Valor em reais com centavos menores e alinhados ao topo (DESIGN §3.2). */
export function MoneyDisplay({ cents, size = "display-sm" }: { cents: number; size?: keyof typeof SIZES }) {
  const parts = BRL.formatToParts(cents / 100);
  const pick = (...types: Intl.NumberFormatPartTypes[]) =>
    parts
      .filter((p) => types.includes(p.type))
      .map((p) => p.value)
      .join("");

  return (
    <span className="inline-flex items-start gap-1.5 text-fg">
      <span className="sr-only">{BRL.format(cents / 100)}</span>
      <span aria-hidden className="mt-[0.2em] text-heading-sm text-fg-muted">
        {pick("currency")}
      </span>
      <span aria-hidden className={`font-display tabular-nums ${SIZES[size]}`}>
        {pick("minusSign", "integer", "group")}
        <span className="align-top text-[0.55em] leading-none">{pick("decimal", "fraction")}</span>
      </span>
    </span>
  );
}
