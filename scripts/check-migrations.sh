#!/usr/bin/env bash
# Verifica que as migrações SQL versionadas produzem exatamente o prisma/schema.prisma.
# Requer DIRECT_URL apontando para um banco VAZIO e descartável (o CI usa um service Postgres).
set -euo pipefail

: "${DIRECT_URL:?defina DIRECT_URL com um banco vazio descartável}"

echo "› Aplicando migrações com o Prisma CLI (mesmo comando do deploy)…"
pnpm -s prisma migrate deploy

echo "› Comparando o banco migrado com o schema.prisma…"
diff_sql="$(pnpm -s prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script)"

# Índices parciais de prisma/sql/constraints.sql não são representáveis no schema Prisma;
# o diff sugere removê-los. Esses (e somente esses) são esperados.
known='cards_one_default_per_user|subscriptions_live_next_charge|invoices_pending_close|invoices_pending_due|notifications_retry_queue|job_runs_one_running_per_job'
remaining="$(printf '%s\n' "$diff_sql" | grep -vE '^[[:space:]]*(--.*)?$' | grep -vE "^DROP INDEX \"(${known})\";$" || true)"

if [[ -n "$remaining" ]]; then
  echo "::error::As migrações divergem do schema.prisma. SQL necessário para alinhar:"
  printf '%s\n' "$diff_sql"
  exit 1
fi
echo "✓ Migrações em sincronia com o schema.prisma."
