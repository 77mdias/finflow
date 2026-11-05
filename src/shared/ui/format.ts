/** Formatação pt-BR para a interface (DESIGN §8): dinheiro, datas e meses. */
import { addDays, type DateOnly } from "@/shared/domain/date-only";

export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (cents: number): string => BRL.format(cents / 100);

// Datas sem horário: formatar ao meio-dia UTC evita virar o dia por fuso.
const noon = (d: string) => new Date(`${d}T12:00:00Z`);
const MONTH = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const MONTH_NAME = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const MONTH_SHORT = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Novembro de 2026" */
export const monthLabel = (ym: string): string => capitalize(MONTH.format(noon(`${ym}-01`)));
/** "novembro" */
export const monthName = (ym: string): string => MONTH_NAME.format(noon(`${ym}-01`));
/** "nov" */
export const monthShort = (ym: string): string => MONTH_SHORT.format(noon(`${ym}-01`)).replace(".", "");
/** "05/12" */
export const dayMonth = (d: string): string => DAY_MONTH.format(noon(d));

/** "Hoje", "Amanhã" ou "qui., 6 de nov." */
export function dayLabel(d: DateOnly, today: DateOnly): string {
  if (d === today) return "Hoje";
  if (d === addDays(today, 1)) return "Amanhã";
  return capitalize(DAY.format(noon(d)));
}
