import "server-only";

import { headers } from "next/headers";

import type { UserContext } from "@/shared/application/context";
import { AppError } from "@/shared/domain/errors";
import { prisma } from "@/shared/infrastructure/db";

import { auth } from "./auth";

export interface SessionUser extends UserContext {
  email: string;
  deletedAt: Date | null;
}

export type SessionProvider = () => Promise<SessionUser | null>;

/** Lê a sessão do Better Auth (cookie) e carrega o usuário do banco. */
const betterAuthSession: SessionProvider = async () => {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await prisma().user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, timezone: true, plan: true, deletedAt: true },
  });
  return user;
};

let provider: SessionProvider = betterAuthSession;

/** Apenas para testes. */
export function setSessionProvider(p: SessionProvider | undefined): void {
  provider = p ?? betterAuthSession;
}

/**
 * Barreira real de autenticação (o `proxy.ts` faz só checagem otimista).
 * Conta em período de exclusão só pode reativar (`allowDeleted`).
 */
export async function requireUser(opts: { allowDeleted?: boolean } = {}): Promise<SessionUser> {
  const user = await provider();
  if (!user) throw new AppError("UNAUTHENTICATED", "Sessão expirada. Entre novamente.");
  if (user.deletedAt && !opts.allowDeleted) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Esta conta está em processo de exclusão. Reative-a para continuar.",
    );
  }
  return user;
}
