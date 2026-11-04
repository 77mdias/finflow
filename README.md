# FinFlow

> Gerencie cartões, assinaturas e faturas em um só lugar — sem conectar nenhum cartão real.

FinFlow é uma aplicação web para **controle pessoal de custos recorrentes**. O usuário cria **cartões virtuais personalizados** (representações dos seus cartões, nunca dados reais), associa a eles suas **assinaturas ativas** e **despesas avulsas/parceladas**, e o sistema calcula automaticamente as **faturas** de cada ciclo, alerta sobre vencimentos e mostra para onde o dinheiro está indo.

## Status

🛠️ **Backend do MVP implementado** (casos de uso, jobs, API HTTP, autenticação) com testes e CI/CD.
🎨 **Frontend**: landing page (`/`) e entrada por magic link (`/entrar`); as telas do app vêm a seguir.

## Stack

- **App:** Next.js 16 (App Router) + React 19 + TypeScript 6, Node.js 24 LTS
- **Dados:** PostgreSQL 16 (Neon em produção) + Prisma 7 (`@prisma/adapter-pg`)
- **Auth:** Better Auth (magic link por e-mail + Google OAuth)
- **E-mail:** Resend (produção) · Mailpit (local)
- **Jobs:** Vercel Cron → rotas idempotentes `/api/cron/*`
- **Qualidade:** Vitest (+ fast-check), ESLint, Prettier, dependency-cruiser, GitHub Actions

## Rodando localmente

Pré-requisitos: Node.js ≥ 22.12 (recomendado 24), pnpm 10 (`corepack enable`), Docker.

```bash
cp .env.example .env            # ajuste os segredos se quiser
docker compose up -d            # Postgres 16 em :5432 e Mailpit em http://localhost:8025
pnpm install                    # também gera o Prisma Client
pnpm db:deploy                  # aplica as migrações
pnpm db:seed                    # (opcional) usuário demo@finflow.local com dados de exemplo
pnpm dev                        # http://localhost:3000
```

### Em container, com secrets do CriptEnv

O app também roda em container com **todos os secrets vindos do [CriptEnv](https://github.com/77mdias/criptenv)** (zero-knowledge, nada em `.env`):

```bash
bash scripts/criptenv-setup.sh seed-vault <project-id>   # cria os secrets de dev no cofre
bash scripts/criptenv-setup.sh credentials               # grava API key / senha do cofre em .criptenv/
docker compose --profile app up --build
```

Guia completo e relatório de teste: [`docs/CRIPTENV.md`](docs/CRIPTENV.md).

Para entrar, solicite um magic link (por enquanto via API, até o frontend existir) e abra o e-mail no Mailpit:

```bash
curl -X POST http://localhost:3000/api/auth/sign-in/magic-link \
  -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
  -d '{"email":"demo@finflow.local","callbackURL":"/dashboard"}'
```

Disparar um job manualmente (idempotente):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
```

## Scripts

| Comando                                              | Descrição                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`             | Next.js                                                                |
| `pnpm test`                                          | Testes unitários (domínio puro)                                        |
| `pnpm test:coverage`                                 | Unitários com cobertura mínima de 90% no domínio                       |
| `pnpm test:int`                                      | Testes de integração contra Postgres real (recria `TEST_DATABASE_URL`) |
| `pnpm lint` · `pnpm typecheck` · `pnpm format:check` | Qualidade                                                              |
| `pnpm lint:deps`                                     | Regras de dependência entre camadas e módulos                          |
| `pnpm db:migrate`                                    | Cria/aplica migração em desenvolvimento (`prisma migrate dev`)         |
| `pnpm db:deploy`                                     | Aplica migrações pendentes (`prisma migrate deploy`)                   |
| `pnpm db:seed`                                       | Dados de demonstração                                                  |
| `pnpm db:check-migrations`                           | Confere migrações × `schema.prisma` (banco vazio em `DIRECT_URL`)      |

## Estrutura

```
src/
├─ app/api/              # Route Handlers: auth, cron, export, unsubscribe, webhooks, health
├─ lib/                  # Better Auth (auth.ts) e sessão (requireUser)
├─ modules/<módulo>/
│  ├─ domain/            # regras puras (RN-*) — sem I/O, 100% testadas
│  ├─ application/       # casos de uso, schemas Zod, queries
│  ├─ ui/actions.ts      # Server Actions ("use server")
│  └─ index.ts           # API pública do módulo
├─ shared/               # domínio comum (DateOnly, Money, erros), infra (db, mailer, rate limit), action()
prisma/                  # schema, migrações, constraints SQL e seed
tests/integration/       # fluxos ponta a ponta contra Postgres
```

Módulos: `invoices` (núcleo: ciclo de fatura, cobranças, pagamentos), `cards`, `subscriptions`, `expenses`, `categories`, `notifications`, `accounts`, `dashboard`, `jobs`.

## CI/CD

- **CI** (`.github/workflows/ci.yml`, em todo PR e na `master`): lint, Prettier, typecheck, regras de dependência, testes unitários com cobertura, lint do OpenAPI, testes de integração (Postgres 16), verificação migrações × schema, build de produção e varredura de segredos (gitleaks).
- **Deploy** (`.github/workflows/deploy.yml`): após o CI verde na `master` — `prisma migrate deploy` → build/deploy na Vercel → smoke test em `/api/health`. Requer os secrets `DIRECT_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` no environment `production` (sem eles, o job é ignorado com aviso).

## Documentação

| Documento                                                                                 | Conteúdo                                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`docs/PRD.md`](docs/PRD.md)                                                              | Visão, personas, escopo, métricas, roadmap                                                                   |
| [`docs/SRS.md`](docs/SRS.md)                                                              | Requisitos funcionais e não funcionais, regras de negócio (RN-\*)                                            |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                            | Stack, infraestrutura, custos, CI/CD e ADRs                                                                  |
| [`docs/SOFTWARE_ARCHITECTURE.md`](docs/SOFTWARE_ARCHITECTURE.md)                          | C4, módulos, camadas, domínio, preocupações transversais, testes                                             |
| [`docs/DATABASE.md`](docs/DATABASE.md)                                                    | Modelagem, dicionário de dados, constraints, consultas, migrações                                            |
| [`docs/API_SPEC.md`](docs/API_SPEC.md) · [`docs/api/openapi.yaml`](docs/api/openapi.yaml) | Server Actions, DTOs, erros, rotas HTTP                                                                      |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md)                                            | Google, Resend, Neon, Vercel, Upstash, Sentry, R2, segredos, LGPD                                            |
| [`docs/FLOW_MAP.md`](docs/FLOW_MAP.md)                                                    | Navegação, jornadas e fluxos                                                                                 |
| [`docs/CRIPTENV.md`](docs/CRIPTENV.md)                                                    | Secrets de desenvolvimento via CriptEnv em container + relatório de teste                                    |
| [`DESIGN.md`](DESIGN.md)                                                                  | Design system: princípios, tokens (cor, tipografia, espaço, forma), Tailwind v4, componentes, acessibilidade |
| [`docs/VISUAL_BRIEF.md`](docs/VISUAL_BRIEF.md)                                            | Briefing visual: análise da referência, direção visual, prancha e telas prioritárias                         |

## Licença e planos

Código aberto sob a [AGPL-3.0](LICENSE). No **self-host** não há limites (`LIMITS_ENFORCED=false`, o padrão). Na nuvem, o plano **Free** segue os limites de [`PLAN_LIMITS`](src/shared/application/plan-limits.ts) (3 cartões e 15 assinaturas) e o **Pro** é ilimitado; exportar e excluir os próprios dados (LGPD) é sempre grátis.
