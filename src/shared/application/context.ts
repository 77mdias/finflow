import type { Plan } from "@/generated/prisma/enums";
import type { DateOnly } from "@/shared/domain/date-only";
import type { Clock } from "@/shared/infrastructure/clock";
import type { Db, Tx } from "@/shared/infrastructure/db";

export interface UserContext {
  id: string;
  timezone: string;
  plan: Plan;
}

/** Contexto de um caso de uso de escrita: transação + usuário + relógio. */
export interface UseCaseContext {
  tx: Tx;
  user: UserContext;
  clock: Clock;
}

/** Contexto de leitura (sem transação obrigatória). */
export interface QueryContext {
  db: Db;
  user: UserContext;
  clock: Clock;
}

export const todayOf = (ctx: { user: UserContext; clock: Clock }): DateOnly =>
  ctx.clock.today(ctx.user.timezone);
