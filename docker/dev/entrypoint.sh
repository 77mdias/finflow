#!/bin/sh
# Entrypoint do container de desenvolvimento: carrega as credenciais do CriptEnv
# e executa o comando com os secrets do cofre injetados (`criptenv run`).
#
# Credenciais aceitas (nesta ordem):
#   1. Docker secrets montados em /run/secrets (recomendado — não aparecem no `docker inspect`)
#        criptenv_api_key, criptenv_vault_password, criptenv_project
#   2. Variáveis *_FILE apontando para arquivos (CRIPTENV_API_KEY_FILE, ...)
#   3. Variáveis diretas (CRIPTENV_API_KEY, CRIPTENV_VAULT_PASSWORD, CRIPTENV_PROJECT)
# O `criptenv run` remove CRIPTENV_API_KEY e CRIPTENV_VAULT_PASSWORD do ambiente da aplicação.
set -eu

load() {
  # load VAR secret_name — preenche VAR a partir de VAR_FILE ou /run/secrets/<secret_name>
  var="$1"; secret="$2"
  eval "current=\${$var:-}"
  [ -n "$current" ] && return 0
  eval "file=\${${var}_FILE:-/run/secrets/$secret}"
  if [ -r "$file" ]; then
    value="$(tr -d '\r\n' < "$file")"
    export "$var=$value"
  fi
  unset "${var}_FILE" 2>/dev/null || true
}

load CRIPTENV_API_KEY criptenv_api_key
load CRIPTENV_VAULT_PASSWORD criptenv_vault_password
load CRIPTENV_PROJECT criptenv_project

missing=""
for v in CRIPTENV_API_KEY CRIPTENV_VAULT_PASSWORD CRIPTENV_PROJECT; do
  eval "val=\${$v:-}"
  [ -z "$val" ] && missing="$missing $v"
done
if [ -n "$missing" ]; then
  echo "finflow: credenciais do CriptEnv ausentes:$missing" >&2
  echo "finflow: rode 'bash scripts/criptenv-setup.sh' ou veja docs/CRIPTENV.md" >&2
  exit 64
fi

env_name="${CRIPTENV_ENVIRONMENT:-development}"
echo "finflow: carregando secrets do CriptEnv (projeto ${CRIPTENV_PROJECT}, ambiente ${env_name})" >&2
exec criptenv run -e "$env_name" -- "$@"
