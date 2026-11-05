import { addDays, daysInMonth, parts, type DateOnly, type YearMonth } from "@/shared/domain/date-only";

/** 0 = domingo … 6 = sábado. */
export const weekday = (d: DateOnly): number => {
  const [y, m, day] = parts(d);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
};

/**
 * Dias da grade do mês (semanas de domingo a sábado), incluindo os dias do mês anterior e do
 * seguinte que completam a primeira e a última semana: 28 a 42 dias, sempre múltiplo de 7.
 */
export function monthGrid(month: YearMonth): DateOnly[] {
  const first = `${month}-01` as DateOnly;
  const [y, m] = parts(first);
  const last = `${month}-${String(daysInMonth(y, m)).padStart(2, "0")}` as DateOnly;
  const start = addDays(first, -weekday(first));
  const end = addDays(last, 6 - weekday(last));
  const days: DateOnly[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}
