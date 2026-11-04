import { prisma } from "@/shared/infrastructure/db";
import { jsonResponse, route } from "@/shared/ui/http";

export const dynamic = "force-dynamic";

const version = `${process.env.npm_package_version ?? "0.0.0"}+${(process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)}`;

/** Liveness + conectividade com o banco (openapi: getHealth). */
export const GET = route(async (_req, requestId) => {
  try {
    await prisma().$queryRaw`SELECT 1`;
    return jsonResponse({ status: "ok", db: "ok", version }, requestId);
  } catch {
    return jsonResponse({ status: "degraded", db: "error", version }, requestId, { status: 503 });
  }
});
