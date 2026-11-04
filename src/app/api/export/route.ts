import { requireUser } from "@/lib/session";
import { todayIn } from "@/shared/domain/date-only";
import { AppError } from "@/shared/domain/errors";
import { prisma } from "@/shared/infrastructure/db";
import { rateLimiter } from "@/shared/infrastructure/rate-limit";
import { jsonResponse, route } from "@/shared/ui/http";

import { exportUserData } from "@/modules/accounts";

export const dynamic = "force-dynamic";

/** RF-006: exportação LGPD (openapi: exportMyData). */
export const GET = route(async (_req, requestId) => {
  const user = await requireUser({ allowDeleted: true });
  const limit = await rateLimiter().check("export", user.id);
  if (!limit.allowed) {
    throw new AppError("RATE_LIMITED", "Muitas exportações. Tente novamente mais tarde.", {
      retryAfter: limit.retryAfterSeconds,
    });
  }
  const data = await exportUserData(prisma(), user.id);
  return jsonResponse(data, requestId, {
    headers: {
      "Content-Disposition": `attachment; filename="finflow-export-${todayIn(user.timezone)}.json"`,
    },
  });
});
