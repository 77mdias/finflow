/**
 * Datas de negócio sem hora nem fuso ("YYYY-MM-DD").
 * Comparação lexicográfica de strings ISO equivale à comparação cronológica.
 * SRS R-03 · RN-01 · RN-02
 */
export type DateOnly = string & { readonly __brand: "DateOnly" };
/** Mês de referência "YYYY-MM". */
export type YearMonth = string & { readonly __brand: "YearMonth" };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YM_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const pad = (n: number) => String(n).padStart(2, "0");

export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Valida e converte uma string "YYYY-MM-DD" (rejeita datas inexistentes como 2027-02-30). */
export function parseDateOnly(value: string): DateOnly {
  const m = DATE_RE.exec(value);
  if (!m) throw new RangeError(`Data inválida: ${value}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) throw new RangeError(`Data inválida: ${value}`);
  return value as DateOnly;
}

export function isDateOnly(value: string): value is DateOnly {
  try {
    parseDateOnly(value);
    return true;
  } catch {
    return false;
  }
}

export const isYearMonth = (value: string): value is YearMonth => YM_RE.test(value);

export function parseYearMonth(value: string): YearMonth {
  if (!YM_RE.test(value)) throw new RangeError(`Mês de referência inválido: ${value}`);
  return value as YearMonth;
}

export const parts = (d: DateOnly): [year: number, month: number, day: number] =>
  d.split("-").map(Number) as [number, number, number];

/** RN-02: um dia inexistente no mês é ajustado para o último dia do mês. */
export const dateOf = (year: number, month: number, day: number): DateOnly =>
  `${year}-${pad(month)}-${pad(Math.min(day, daysInMonth(year, month)))}` as DateOnly;

/** Aritmética de meses sobre (ano, mês 1–12). */
export const addMonths = (year: number, month: number, n: number): [number, number] => {
  const t = year * 12 + (month - 1) + n;
  return [Math.floor(t / 12), (t % 12) + 1];
};

/** Soma `n` meses mantendo o dia (com ajuste da RN-02). */
export function addMonthsTo(d: DateOnly, n: number): DateOnly {
  const [y, m, day] = parts(d);
  const [ny, nm] = addMonths(y, m, n);
  return dateOf(ny, nm, day);
}

export function addDays(d: DateOnly, n: number): DateOnly {
  const [y, m, day] = parts(d);
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10) as DateOnly;
}

export const yearMonthOf = (d: DateOnly): YearMonth => d.slice(0, 7) as YearMonth;
export const yearMonth = (year: number, month: number): YearMonth => `${year}-${pad(month)}` as YearMonth;

export function addYearMonths(ym: YearMonth, n: number): YearMonth {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const [ny, nm] = addMonths(y, m, n);
  return yearMonth(ny, nm);
}

export const compareDates = (a: DateOnly, b: DateOnly): number => (a < b ? -1 : a > b ? 1 : 0);
export const maxDate = (a: DateOnly, b: DateOnly): DateOnly => (a > b ? a : b);
export const minDate = (a: DateOnly, b: DateOnly): DateOnly => (a < b ? a : b);

export function daysBetween(from: DateOnly, to: DateOnly): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Converte o `Date` (00:00 UTC) devolvido pelo Prisma para colunas `@db.Date`. */
export const fromDbDate = (date: Date): DateOnly => date.toISOString().slice(0, 10) as DateOnly;

/** Converte para o `Date` esperado pelo Prisma em colunas `@db.Date`. */
export const toDbDate = (d: DateOnly): Date => new Date(`${d}T00:00:00.000Z`);

/** RN-01: "hoje" no fuso do usuário. */
export function todayIn(timeZone: string, now: Date = new Date()): DateOnly {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now) as DateOnly;
}

/** Hora local (0–23) no fuso informado. */
export function hourIn(timeZone: string, now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now);
  return Number(h);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
