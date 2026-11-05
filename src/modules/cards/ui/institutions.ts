import { initials } from "@/shared/ui/format";

/**
 * Instituições conhecidas (DESIGN §2.5): cor de referência e iniciais do selo, com contraste AA
 * medido. Aproximações para reconhecer o cartão, nunca logotipos.
 */
export const INSTITUTIONS: ReadonlyArray<{ name: string; initials: string; color: string; dark?: true }> = [
  { name: "Nubank", initials: "NU", color: "#820AD1" },
  { name: "PicPay", initials: "PP", color: "#11A84E", dark: true },
  { name: "Itaú", initials: "IT", color: "#EC7000", dark: true },
  { name: "Inter", initials: "IN", color: "#FF7A00", dark: true },
  { name: "C6 Bank", initials: "C6", color: "#242424" },
  { name: "Bradesco", initials: "BR", color: "#CC092F" },
  { name: "Santander", initials: "SA", color: "#EC0000" },
  { name: "Banco do Brasil", initials: "BB", color: "#FCE300", dark: true },
  { name: "Caixa", initials: "CX", color: "#005CA9" },
  { name: "Mercado Pago", initials: "MP", color: "#00A3E0", dark: true },
  { name: "BTG Pactual", initials: "BT", color: "#0B2B5B" },
  { name: "Neon", initials: "NE", color: "#0BA5E9", dark: true },
  { name: "PagBank", initials: "PB", color: "#1FA85A", dark: true },
  { name: "XP", initials: "XP", color: "#1A1A1A" },
];

const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

/** Selo de um emissor: cor e iniciais da tabela, ou `ink-600` com as iniciais do texto livre. */
export function institutionBadge(issuer: string): { initials: string; color: string; dark: boolean } {
  const known = INSTITUTIONS.find((i) => normalize(i.name) === normalize(issuer));
  return known
    ? { initials: known.initials, color: known.color, dark: known.dark ?? false }
    : { initials: initials(issuer), color: "var(--color-ink-600)", dark: false };
}
