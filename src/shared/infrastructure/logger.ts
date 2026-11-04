import pino from "pino";

/**
 * Logs estruturados em JSON. Campos sensíveis são removidos (RNF-16):
 * nunca logar e-mail completo, tokens, cookies ou segredos.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  base: { service: "finflow" },
  redact: {
    paths: [
      "email",
      "*.email",
      "token",
      "*.token",
      "password",
      "*.password",
      "authorization",
      "*.authorization",
      "headers.cookie",
      "*.headers.cookie",
      "secret",
      "*.secret",
    ],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;

/** Mascara um e-mail para logs ("a***@exemplo.com"). */
export const maskEmail = (email: string): string => email.replace(/^(.).*(@.*)$/, "$1***$2");
