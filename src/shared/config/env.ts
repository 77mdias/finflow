import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),

    DATABASE_URL: z.string().min(1),

    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET deve ter ao menos 32 caracteres"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),
    OAUTH_PROXY_PRODUCTION_URL: z.url().optional(),

    EMAIL_TRANSPORT: z.enum(["resend", "smtp", "memory"]).default("smtp"),
    EMAIL_FROM: z.string().min(3).default("FinFlow <lembretes@mail.finflow.app>"),
    SMTP_URL: z.string().default("smtp://localhost:1025"),
    RESEND_API_KEY: z.string().optional(),
    RESEND_WEBHOOK_SECRET: z.string().optional(),

    CRON_SECRET: z.string().min(16, "CRON_SECRET deve ter ao menos 16 caracteres"),
    UNSUBSCRIBE_SECRET: z.string().min(16, "UNSUBSCRIBE_SECRET deve ter ao menos 16 caracteres"),

    RATE_LIMIT_DRIVER: z.enum(["memory", "upstash"]).default("memory"),
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    LIMITS_ENFORCED: bool,
    REMINDER_LOCAL_WINDOW: bool,
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_TRANSPORT === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "obrigatório com EMAIL_TRANSPORT=resend",
      });
    }
    if (
      env.RATE_LIMIT_DRIVER === "upstash" &&
      (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["UPSTASH_REDIS_REST_URL"],
        message: "obrigatório com RATE_LIMIT_DRIVER=upstash",
      });
    }
    if (env.NODE_ENV === "production" && env.EMAIL_TRANSPORT === "memory") {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_TRANSPORT"],
        message: "memory não é permitido em produção",
      });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/**
 * Variáveis de ambiente validadas (falha rápida). Avaliação preguiçosa para não quebrar
 * o `next build`, que importa os módulos sem os segredos de runtime.
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Apenas para testes. */
export function resetEnvCache(): void {
  cached = undefined;
}
