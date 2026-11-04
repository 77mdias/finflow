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

const merge = (into: JobStats, from: JobStats) => {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
};

/**
 * Executa um job com trava (índice único parcial `job_runs_one_running_per_job`) e
 * registro em `job_runs` (RNF-52). Lança CONFLICT se outra execução estiver em andamento.
 */
export async function runJob(
  db: Db,
  job: JobName,
  fn: (ctx: { stats: JobStats; addError: (e: unknown, meta?: object) => void }) => Promise<void>,
): Promise<JobRunResult> {
  await db.jobRun.updateMany({
    where: { job, status: "RUNNING", startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
    data: { status: "FAILED", finishedAt: new Date(), error: "execução travada liberada" },
  });
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
  try {
    await fn({
      stats,
      addError: (e, meta) => {
        stats.errors = (stats.errors ?? 0) + 1;
        errors.push(String(e instanceof Error ? e.message : e).slice(0, 300));
        logger.error({ err: e, job, ...meta }, "erro em lote de job");
      },
    });
    if ((stats.errors ?? 0) > 0) status = "PARTIAL";
  } catch (e) {
    status = "FAILED";
    errors.push(String(e instanceof Error ? e.message : e));
    logger.error({ err: e, job }, "job falhou");
  }
  const finished = await db.jobRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt: new Date(),
      stats: stats as Prisma.InputJsonValue,
      error: errors.length ? errors.join("\n").slice(0, 4000) : null,
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

/** Itera usuários ativos em lotes (cursor por id), já com "hoje" no fuso de cada um (RN-01). */
export async function forEachUserBatch(
  db: Db,
  clock: Clock,
  fn: (users: BatchUser[]) => Promise<JobStats>,
  opts: {
    stats: JobStats;
    addError: (e: unknown, meta?: object) => void;
    filter?: (u: BatchUser) => boolean;
  },
): Promise<void> {
  let cursor: string | undefined;
  const now = clock.now();
  for (;;) {
    const page = await db.user.findMany({
      where: { deletedAt: null },
      select: { id: true, timezone: true },
      orderBy: { id: "asc" },
      take: USER_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;
    cursor = page.at(-1)!.id;
    const users = page
      .map((u) => ({ ...u, today: todayIn(u.timezone, now) }))
      .filter((u) => (opts.filter ? opts.filter(u) : true));
    opts.stats.usersProcessed = (opts.stats.usersProcessed ?? 0) + users.length;
    if (users.length === 0) continue;
    try {
      merge(opts.stats, await fn(users));
    } catch (e) {
      opts.addError(e, { firstUserId: users[0]!.id, batchSize: users.length });
    }
    if (page.length < USER_BATCH_SIZE) break;
  }
}

/** Filtro da janela 08:00–09:00 local (RN-20). */
export const inLocalWindow = (clock: Clock) => (u: { timezone: string }) =>
  hourIn(u.timezone, clock.now()) === 8;
