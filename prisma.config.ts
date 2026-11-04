// Prisma 7 — configuração do CLI (migrate, seed, studio).
// Migrações usam a conexão DIRETA (sem PgBouncer); a aplicação usa a conexão
// pooled via driver adapter (src/shared/infrastructure/db.ts).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Opcional para `prisma generate`; obrigatório para migrate.
    url: process.env.DIRECT_URL,
  },
});
