import { todayIn, type DateOnly } from "@/shared/domain/date-only";

/** Relógio injetável (RN-01): "hoje" sempre no fuso do usuário. */
export interface Clock {
  now(): Date;
  today(timeZone: string): DateOnly;
}

export const systemClock: Clock = {
  now: () => new Date(),
  today: (tz) => todayIn(tz, new Date()),
};

/** Relógio fixo para testes. */
export function fixedClock(instant: string | Date): Clock {
  const at = typeof instant === "string" ? new Date(instant) : instant;
  return { now: () => new Date(at), today: (tz) => todayIn(tz, at) };
}
