# FinFlow

> Gerencie cartões, assinaturas e faturas em um só lugar — sem conectar nenhum cartão real.

FinFlow é uma aplicação web para **controle pessoal de custos recorrentes**. O usuário cria **cartões virtuais personalizados** (representações dos seus cartões, nunca dados reais), associa a eles suas **assinaturas ativas** e **despesas avulsas/parceladas**, e o sistema calcula automaticamente as **faturas** de cada ciclo, alerta sobre vencimentos e mostra para onde o dinheiro está indo.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product Requirements Document — visão, personas, escopo, métricas, roadmap |
| [`docs/SRS.md`](docs/SRS.md) | Software Requirements Specification — requisitos funcionais, não funcionais, regras de negócio, modelo de dados |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Visão geral da arquitetura, stack, infraestrutura, custos, CI/CD e decisões (ADRs) |
| [`docs/SOFTWARE_ARCHITECTURE.md`](docs/SOFTWARE_ARCHITECTURE.md) | Arquitetura de software: C4, módulos, camadas, modelo de domínio, preocupações transversais, frontend, testes |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Modelagem de dados: diagramas ER, dicionário de dados, constraints, índices, consultas, migrações, retenção |
| [`docs/API_SPEC.md`](docs/API_SPEC.md) | Especificação de API: Server Actions, query services, DTOs, erros, rotas HTTP, REST v1 planejada |
| [`docs/api/openapi.yaml`](docs/api/openapi.yaml) | Contrato OpenAPI 3.1 das rotas HTTP |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Integrações externas: Google, Resend, Neon, Vercel, Upstash, Sentry, R2, GitHub Actions, segredos, LGPD |
| [`docs/FLOW_MAP.md`](docs/FLOW_MAP.md) | Mapa de fluxos: navegação, jornadas do usuário, ciclo de vida de fatura/assinatura, jobs |

## Stack (resumo)

- **App:** Next.js 16 (App Router, Cache Components) + React 19 + TypeScript, Node.js 24 LTS
- **UI:** Tailwind CSS + shadcn/ui + Recharts
- **Dados:** PostgreSQL 16 (Neon) + Prisma 7
- **Auth:** Better Auth (magic link por e-mail + Google OAuth)
- **Jobs/cron:** Vercel Cron → rotas internas idempotentes
- **E-mail:** Resend
- **Hospedagem:** Vercel (app) + Neon (banco) — free tier no MVP
- **Qualidade:** Vitest, Playwright, ESLint, Prettier, GitHub Actions

Detalhes e justificativas em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Status

📐 Fase de especificação. O schema do banco já está definido em [`prisma/schema.prisma`](prisma/schema.prisma) (+ [`prisma/sql/constraints.sql`](prisma/sql/constraints.sql)); ainda não há código de aplicação.
