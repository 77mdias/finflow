#!/usr/bin/env bash
# FinFlow × CriptEnv — configuração do ambiente de desenvolvimento em container.
#
#   bash scripts/criptenv-setup.sh seed-vault <project-id> [ambiente]
#       Gera os secrets de desenvolvimento do FinFlow e envia ao cofre (apenas as
#       chaves que ainda não existem). Requer `criptenv login` feito no host.
#
#   bash scripts/criptenv-setup.sh credentials
#       Grava as credenciais do container em .criptenv/ (permissão 600, fora do Git):
#       API key (somente leitura), senha do cofre e ID do projeto.
#
# Guia completo: docs/CRIPTENV.md
set -euo pipefail

cd "$(dirname "$0")/.."
CRED_DIR=".criptenv"

require_cli() {
  command -v criptenv >/dev/null 2>&1 || {
    echo "CLI do CriptEnv não encontrada. Instale com: pip install criptenv" >&2
    exit 1
  }
}

seed_vault() {
  local project="${1:?uso: seed-vault <project-id> [ambiente]}"
  local env_name="${2:-development}"
  require_cli

  # Chaves já presentes no cofre (só nomes — valores nunca são exibidos).
  local existing
  existing="$(criptenv list -p "$project" -e "$env_name" 2>/dev/null | awk '/^  [A-Z0-9_]+ /{print $1}')"

  # Arquivo temporário com os valores em claro: 600 e removido ao sair (inclusive em erro).
  SEED_TMP="$(mktemp)"
  chmod 600 "$SEED_TMP"
  trap 'rm -f "${SEED_TMP:-}"' EXIT
  local tmp="$SEED_TMP"

  add() { # add KEY VALUE — inclui só se a chave ainda não existe no cofre
    if grep -qx "$1" <<<"$existing"; then
      echo "  = $1 (já existe, mantido)"
    else
      printf '%s=%s\n' "$1" "$2" >>"$tmp"
      echo "  + $1"
    fi
  }

  echo "Secrets de desenvolvimento para o projeto $project / ambiente $env_name:"
  # Endereços da rede do docker compose (serviços `db` e `mailpit`).
  add DATABASE_URL "postgresql://finflow:finflow@db:5432/finflow"
  add DIRECT_URL "postgresql://finflow:finflow@db:5432/finflow"
  add BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
  add CRON_SECRET "$(openssl rand -hex 24)"
  add UNSUBSCRIBE_SECRET "$(openssl rand -hex 24)"
  add EMAIL_TRANSPORT "smtp"
  add SMTP_URL "smtp://mailpit:1025"
  add EMAIL_FROM "FinFlow <lembretes@mail.finflow.app>"
  add NEXT_PUBLIC_APP_URL "http://localhost:3000"

  if [[ -s "$tmp" ]]; then
    criptenv push "$tmp" -p "$project" -e "$env_name"
  else
    echo "Nada a enviar: o cofre já tem todas as chaves."
  fi
}

credentials() {
  mkdir -p "$CRED_DIR"
  chmod 700 "$CRED_DIR"
  local key password project
  read -r -s -p "API key do CriptEnv (somente leitura, ex.: cek_...): " key; echo
  read -r -s -p "Senha do cofre (vault password) do projeto: " password; echo
  read -r -p "ID do projeto no CriptEnv: " project
  [[ -n "$key" && -n "$password" && -n "$project" ]] || { echo "Todos os campos são obrigatórios." >&2; exit 1; }
  umask 077
  printf '%s' "$key" >"$CRED_DIR/api_key"
  printf '%s' "$password" >"$CRED_DIR/vault_password"
  printf '%s' "$project" >"$CRED_DIR/project"
  echo "Credenciais gravadas em $CRED_DIR/ (permissão 600, ignorado pelo Git)."
  echo "Suba o app com: docker compose --profile app up --build"
}

case "${1:-}" in
  seed-vault) shift; seed_vault "$@" ;;
  credentials) credentials ;;
  *)
    sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
