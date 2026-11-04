import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";

import { TEST_DATABASE_URL } from "./test-env";

/**
 * Recria o banco de testes e aplica as migrações SQL na ordem (mesmo SQL que o
 * `prisma migrate deploy` aplica em produção).
 */
export default async function globalSetup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/i.test(dbName) || !dbName.includes("test")) {
    throw new Error(`Recusando recriar banco que não parece de teste: ${dbName}`);
  }
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  const dir = join(process.cwd(), "prisma", "migrations");
  for (const m of readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()) {
    await client.query(readFileSync(join(dir, m, "migration.sql"), "utf8"));
  }
  await client.end();
}
