import type { JobName, JobStatus, Prisma } from "@/generated/prisma/client";
import { hourIn, todayIn, type DateOnly } from "@/shared/domain/date-only";
import { AppError } from "@/shared/domain/errors";
import type { Clock } from "@/shared/infrastructure/clock";
import { isUniqueViolation, type Db } from "@/shared/infrastructure/db";
import { logger } from "@/shared/infrastructure/logger";

export const USER_BATCH_SIZE = 200;
/** Execuções RUNNING mais antigas que isso são consideradas travadas e liberadas. */
const STALE_RUN_MS = 30 * 60_000;

export type JobStats = Record<string, number>;

export interface JobRunResult {
  jobRunId: string;
  job: JobName;
  status: Exclude<JobStatus, "RUNNING">;
  startedAt: string;
  finishedAt: string;
  stats: JobStats;
}

export const mergeStats = (into: JobStats, from: JobStats) => {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
};

export interface JobContext {
  stats: JobStats;
  addError: (e: unknown, meta?: object) => void;
  /** Cursor da execução anterior que não terminou (FAILED); `null` = começar do início. */
  resumeAfter: string | null;
  /** Grava o último usuário concluído, para a próxima execução retomar se esta cair. */
  checkpoint: (cursor: string) => Promise<void>;
}

/**
 * Executa um job com trava (índice único parcial `job_runs_one_running_per_job`) e
 * registro em `job_runs` (RNF-52). Lança CONFLICT se outra execução estiver em andamento.
 */
export async function runJob(
  db: Db,
  job: JobName,
  fn: (ctx: JobContext) => Promise<void>,
): Promise<JobRunResult> {
  await db.jobRun.updateMany({
    where: { job, status: "RUNNING", startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
    data: { status: "FAILED", finishedAt: new Date(), error: "execução travada liberada" },
  });
  const last = await db.jobRun.findFirst({
    where: { job },
    orderBy: { startedAt: "desc" },
    select: { status: true, cursor: true },
  });
  const resumeAfter = last?.status === "FAILED" ? last.cursor : null;
  let run;
  try {
    run = await db.jobRun.create({ data: { job } });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("CONFLICT", "Job já em execução.");
    throw e;
  }
  const stats: JobStats = { errors: 0 };
  const errors: string[] = [];
  let status: Exclude<JobStatus, "RUNNING"> = "SUCCEEDED";
  const runId = run.id;
  try {
    await fn({
      stats,
      addError: (e, meta) => {
        stats.errors = (stats.errors ?? 0) + 1;
        errors.push(String(e instanceof Error ? e.message : e).slice(0, 300));
        logger.error({ err: e, job, ...meta }, "erro em lote de job");
      },
      resumeAfter,
      checkpoint: async (cursor) => {
        await db.jobRun.update({ where: { id: runId }, data: { cursor } });
      },
    });
    if ((stats.errors ?? 0) > 0) status = "PARTIAL";
  } catch (e) {
    status = "FAILED";
    errors.push(String(e instanceof Error ? e.message : e));
    logger.error({ err: e, job }, "job falhou");
  }
  const finished = await db.jobRun.update({
    where: { id: runId },
    data: {
      status,
      finishedAt: new Date(),
      stats: stats as Prisma.InputJsonValue,
      error: errors.length ? errors.join("\n").slice(0, 4000) : null,
      // Terminou a volta: a próxima começa do início. Se caiu, o cursor fica para ela retomar.
      ...(status === "FAILED" ? {} : { cursor: null }),
    },
  });
  logger.info({ job, status, stats }, "job concluído");
  return {
    jobRunId: run.id,
    job,
    status,
    startedAt: finished.startedAt.toISOString(),
    finishedAt: (finished.finishedAt ?? new Date()).toISOString(),
    stats,
  };
}

export interface BatchUser {
  id: string;
  timezone: string;
  today: DateOnly;
}

/**
 * Itera usuários ativos em lotes (por id), já com "hoje" no fuso de cada um (RN-01).
 * Com `resumeAfter`, começa depois dele e dá a volta até ele: quem ficou de fora de uma execução
 * que caiu é o primeiro da seguinte. `checkpoint` recebe o último id de cada lote concluído.
 */
export async function forEachUserBatch(
  db: Db,
  clock: Clock,
  fn: (users: BatchUser[]) => Promise<JobStats>,
  opts: Pick<JobContext, "stats" | "addError"> &
    Partial<Pick<JobContext, "resumeAfter" | "checkpoint">> & {
      filter?: (u: BatchUser) => boolean;
      batchSize?: number;
    },
): Promise<void> {
  const now = clock.now();
  const size = opts.batchSize ?? USER_BATCH_SIZE;
  const pass = async (until?: string) => {
    let after = until ? undefined : (opts.resumeAfter ?? undefined);
    for (;;) {
      const page = await db.user.findMany({
        where: {
          deletedAt: null,
          ...(after || until
            ? { id: { ...(after ? { gt: after } : {}), ...(until ? { lte: until } : {}) } }
            : {}),
        },
        select: { id: true, timezone: true },
        orderBy: { id: "asc" },
        take: size,
      });
      if (page.length === 0) return;
      after = page.at(-1)!.id;
      const users = page
        .map((u) => ({ ...u, today: todayIn(u.timezone, now) }))
        .filter((u) => (opts.filter ? opts.filter(u) : true));
      opts.stats.usersProcessed = (opts.stats.usersProcessed ?? 0) + users.length;
      if (users.length > 0) {
        try {
          mergeStats(opts.stats, await fn(users));
        } catch (e) {
          opts.addError(e, { firstUserId: users[0]!.id, batchSize: users.length });
        }
      }
      await opts.checkpoint?.(after);
      if (page.length < size) return;
    }
  };
  await pass();
  if (opts.resumeAfter) await pass(opts.resumeAfter);
}

/**
 * Uma transação por usuário (regra 5 da auditoria): o erro ou o timeout de um não desfaz o
 * trabalho dos outros do lote; vira um erro registrado no job.
 */
export async function forEachUser(
  users: readonly BatchUser[],
  fn: (u: BatchUser) => Promise<JobStats>,
  addError: JobContext["addError"],
): Promise<JobStats> {
  const stats: JobStats = {};
  for (const u of users) {
    try {
      mergeStats(stats, await fn(u));
    } catch (e) {
      addError(e, { userId: u.id });
    }
  }
  return stats;
}

/** Filtro da janela 08:00–09:00 local (RN-20). */
export const inLocalWindow = (clock: Clock) => (u: { timezone: string }) =>
  hourIn(u.timezone, clock.now()) === 8;
