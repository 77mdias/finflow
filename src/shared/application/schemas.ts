import { z } from "zod";

import { isDateOnly, isValidTimeZone, type DateOnly } from "@/shared/domain/date-only";
import { parseMoney } from "@/shared/domain/money";

/** Tipos de entrada compartilhados (docs/API_SPEC.md §5.1). */
export const Id = z.uuid({ message: "Identificador inválido" });

export const DateOnlyInput = z
  .string()
  .refine(isDateOnly, "Data inválida (use AAAA-MM-DD)")
  .transform((v) => v as DateOnly);

export const DayOfMonth = z.int().min(1, "Entre 1 e 31").max(31, "Entre 1 e 31");

const MAX_CENTS = 100_000_000_00n; // R$ 100 milhões

const moneyString = z.string().trim().min(1, "Informe um valor");

/** "1.234,56" → 123456n (> 0). */
export const MoneyInput = moneyString.transform((v, ctx) => {
  try {
    const cents = parseMoney(v);
    if (cents <= 0n || cents > MAX_CENTS) {
      ctx.addIssue({ code: "custom", message: "Valor fora do intervalo permitido" });
      return z.NEVER;
    }
    return cents;
  } catch {
    ctx.addIssue({ code: "custom", message: "Valor inválido (ex.: 55,90)" });
    return z.NEVER;
  }
});

/** Valor com sinal, diferente de zero (ajustes). */
export const SignedMoneyInput = moneyString.transform((v, ctx) => {
  try {
    const cents = parseMoney(v);
    if (cents === 0n || cents > MAX_CENTS || cents < -MAX_CENTS) {
      ctx.addIssue({ code: "custom", message: "Valor não pode ser zero" });
      return z.NEVER;
    }
    return cents;
  } catch {
    ctx.addIssue({ code: "custom", message: "Valor inválido (ex.: -10,00)" });
    return z.NEVER;
  }
});

export const OptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v ? v : undefined))
    .optional();

export const ExpectedUpdatedAt = z.iso.datetime({ offset: true }).optional();
export const ClientRequestId = z.uuid().optional();
export const TimeZoneInput = z.string().refine(isValidTimeZone, "Fuso horário inválido");
