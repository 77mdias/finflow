/** Códigos de erro estáveis (contrato da API — docs/API_SPEC.md §3). */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "RATE_LIMITED",
  "PLAN_LIMIT_REACHED",
  "CARD_ARCHIVED",
  "CARD_HAS_ACTIVE_SUBSCRIPTIONS",
  "CARD_HAS_HISTORY",
  "INVALID_STATE_TRANSITION",
  "INVOICE_LOCKED",
  "PAYMENT_EXCEEDS_BALANCE",
  "CATEGORY_IS_SYSTEM",
  "SUBSCRIPTION_HAS_CHARGES",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PLAN_LIMIT_REACHED: 403,
  CARD_ARCHIVED: 422,
  CARD_HAS_ACTIVE_SUBSCRIPTIONS: 422,
  CARD_HAS_HISTORY: 422,
  INVALID_STATE_TRANSITION: 422,
  INVOICE_LOCKED: 422,
  PAYMENT_EXCEEDS_BALANCE: 422,
  CATEGORY_IS_SYSTEM: 422,
  SUBSCRIPTION_HAS_CHARGES: 422,
  INTERNAL: 500,
};

/** Erro de aplicação com código estável e mensagem exibível ao usuário (pt-BR). */
export class AppError extends Error {
  override readonly name = "AppError";

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: { fieldErrors?: Record<string, string[]>; [key: string]: unknown },
  ) {
    super(message);
  }

  static notFound(entity: string): AppError {
    return new AppError("NOT_FOUND", `${entity} não encontrado(a).`);
  }

  static validation(message: string, fieldErrors?: Record<string, string[]>): AppError {
    return new AppError("VALIDATION_ERROR", message, fieldErrors ? { fieldErrors } : undefined);
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
