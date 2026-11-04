import type { ErrorCode } from "./errors";

/** Resultado de operações de domínio com falhas esperadas (sem exceções). */
export type Result<T> = { ok: true; value: T } | { ok: false; code: ErrorCode; message: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(code: ErrorCode, message: string): Result<T> => ({
  ok: false,
  code,
  message,
});
