import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { env } from "@/shared/config/env";

/** Cliente transacional (dentro de `$transaction`) ou o cliente raiz. */
export type Db = PrismaClient | Prisma.TransactionClient;
export type Tx = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient(connectionString: string): PrismaClient {
  // Neon (endpoint pooled) e Postgres local usam o mesmo driver `pg`.
  const adapter = new PrismaPg({ connectionString, max: 5 });
  return new PrismaClient({ adapter });
}

/** Singleton (reaproveitado entre hot reloads em desenvolvimento). */
export function prisma(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient(env().DATABASE_URL);
  return globalForPrisma.prisma;
}

/** Apenas para testes: substitui o cliente global. */
export function setPrismaClient(client: PrismaClient | undefined): void {
  globalForPrisma.prisma = client;
}

/** Executa `fn` em uma transação interativa (Unit of Work). */
export function transaction<T>(fn: (tx: Tx) => Promise<T>, client: PrismaClient = prisma()): Promise<T> {
  return client.$transaction(fn, { timeout: 15_000, maxWait: 5_000 });
}

/** Violação de chave única do Postgres/Prisma. */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";
}
