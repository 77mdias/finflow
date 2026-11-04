import "server-only";

import { systemClock } from "@/shared/infrastructure/clock";
import { prisma } from "@/shared/infrastructure/db";
import { mailer } from "@/shared/infrastructure/mailer";
import { assertCronAuth, jsonResponse, route } from "@/shared/ui/http";

import type { JobDeps, JobRunResult } from "@/modules/jobs";

/** Handler GET padrão dos crons: autentica, executa o job e devolve JobRunResult. */
export function cronRoute(run: (deps: JobDeps) => Promise<JobRunResult>) {
  return route(async (req, requestId) => {
    assertCronAuth(req);
    const result = await run({ db: prisma(), clock: systemClock, mailer: mailer() });
    return jsonResponse(result, requestId, { status: result.status === "FAILED" ? 500 : 200 });
  });
}
