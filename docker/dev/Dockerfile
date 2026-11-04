# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# FinFlow — imagem de DESENVOLVIMENTO com secrets vindos do CriptEnv.
#
# Nenhum secret da aplicação existe na imagem nem em arquivos .env: o entrypoint
# executa `criptenv run`, que busca o cofre, decifra os valores EM MEMÓRIA
# (zero-knowledge, AES-256-GCM) e injeta como variáveis de ambiente no processo.
# Guia: docs/CRIPTENV.md
# ─────────────────────────────────────────────────────────────────────────────

# Versão da CLI do CriptEnv (binário único, sem Python). Fixe uma tag para builds reprodutíveis.
ARG CRIPTENV_IMAGE=ghcr.io/77mdias/criptenv-cli:latest
FROM ${CRIPTENV_IMAGE} AS criptenv

FROM node:24-bookworm-slim AS dev

# O binário do CriptEnv é glibc (Debian/Ubuntu); imagens Alpine não são suportadas.
COPY --from=criptenv /usr/local/bin/criptenv /usr/local/bin/criptenv

# uid/gid 1000 = o usuário do host: o código montado (.:/app) e os secrets em .criptenv/ precisam
# ser graváveis/legíveis pelo processo. shortcut: assume host com uid 1000; se o seu for outro, vire build arg.
RUN corepack enable \
 && userdel --remove node \
 && groupadd --gid 1000 finflow \
 && useradd --create-home --uid 1000 --gid finflow finflow \
 && mkdir -p /app && chown finflow:finflow /app

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    CRIPTENV_ENVIRONMENT=development

USER finflow

# Dependências primeiro (cache de camadas). O postinstall gera o Prisma Client.
COPY --chown=finflow:finflow package.json pnpm-lock.yaml prisma.config.ts ./
COPY --chown=finflow:finflow prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY --chown=finflow:finflow . .
# .next fica fora do contexto (.dockerignore); sem ele na imagem, o volume do compose nasce com dono root.
RUN mkdir -p .next
COPY --chown=finflow:finflow --chmod=0755 docker/dev/entrypoint.sh /usr/local/bin/finflow-entrypoint

EXPOSE 3000
ENTRYPOINT ["finflow-entrypoint"]
# Regenera o Prisma Client (reflete mudanças no schema a cada start), aplica migrações
# e sobe o servidor de desenvolvimento — tudo com os secrets do cofre.
CMD ["sh", "-c", "pnpm db:generate && pnpm db:deploy && exec pnpm dev --hostname 0.0.0.0"]
