# FinFlow

> Gerencie cartões, assinaturas e faturas em um só lugar — sem conectar nenhum cartão real.

FinFlow é uma aplicação web para **controle pessoal de custos recorrentes**. O usuário cria **cartões virtuais personalizados** (representações dos seus cartões, nunca dados reais), associa a eles suas **assinaturas ativas** e **despesas avulsas/parceladas**, e o sistema calcula automaticamente as **faturas** de cada ciclo, alerta sobre vencimentos e mostra para onde o dinheiro está indo.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product Requirements Document — visão, personas, escopo, métricas, roadmap |
| [`docs/SRS.md`](docs/SRS.md) | Software Requirements Specification — requisitos funcionais, não funcionais, regras de negócio, modelo de dados |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitetura da aplicação, infraestrutura e decisões (ADRs) |
| [`docs/FLOW_MAP.md`](docs/FLOW_MAP.md) | Mapa de fluxos: navegação, jornadas do usuário, ciclo de vida de fatura/assinatura, jobs |

## Stack (resumo)

- **App:** Next.js 15 (App Router) + TypeScript + React Server Components
- **UI:** Tailwind CSS + shadcn/ui + Recharts
- **Dados:** PostgreSQL (Neon) + Prisma ORM
- **Auth:** Auth.js (e-mail magic link + Google OAuth)
- **Jobs/cron:** Vercel Cron → rotas internas idempotentes
- **E-mail:** Resend
- **Hospedagem:** Vercel (app) + Neon (banco) — free tier no MVP
- **Qualidade:** Vitest, Playwright, ESLint, Prettier, GitHub Actions

Detalhes e justificativas em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Status

📐 Fase de especificação — nenhum código de aplicação ainda.
