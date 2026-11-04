import { fromDbDate, type DateOnly } from "@/shared/domain/date-only";
import { centsToNumber } from "@/shared/domain/money";

/** Conversões para DTOs serializáveis (docs/API_SPEC.md §6.1). */
export const n = (cents: bigint): number => centsToNumber(cents);
export const nOrNull = (cents: bigint | null): number | null =>
  cents === null ? null : centsToNumber(cents);
export const day = (d: Date): DateOnly => fromDbDate(d);
export const dayOrNull = (d: Date | null): DateOnly | null => (d ? fromDbDate(d) : null);
export const iso = (d: Date): string => d.toISOString();
export const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);
