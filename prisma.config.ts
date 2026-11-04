// Prisma 7 — configuração do CLI (migrate, seed, studio).
// Migrações usam a conexão DIRETA (sem PgBouncer); a aplicação usa a conexão
// pooled via driver adapter (ver docs/DATABASE.md §8).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
