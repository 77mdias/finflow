# FinFlow — Product Requirements Document (PRD)

| Campo | Valor |
|---|---|
| Produto | FinFlow |
| Versão do documento | 1.0 |
| Data | 2026-11-04 |
| Status | Rascunho para validação |
| Documentos relacionados | [SRS](SRS.md) · [Arquitetura](ARCHITECTURE.md) · [Mapa de Fluxo](FLOW_MAP.md) |

---

## 1. Visão

**Dar clareza total sobre quanto, quando e onde o usuário paga seus custos recorrentes.**

Hoje as pessoas acumulam assinaturas (streaming, software, academia, nuvem, apps) espalhadas em vários cartões. Elas descobrem o valor real só quando a fatura chega, esquecem de cancelar testes gratuitos e não sabem qual cartão concentra cada gasto. O FinFlow resolve isso com um painel único onde o usuário modela seus cartões, cadastra o que é cobrado em cada um e vê as faturas futuras antes delas acontecerem.

### 1.1 Princípio fundamental: nenhum dado real de cartão

O FinFlow **não** é um banco, carteira digital ou agregador financeiro. Os cartões são **representações criadas pelo usuário** (apelido, cor, limite, dia de fechamento e vencimento). O sistema **nunca** solicita, armazena ou processa número de cartão (PAN), CVV, data de validade real ou credenciais bancárias. Isso elimina escopo PCI-DSS e reduz drasticamente o risco do produto.

## 2. Problema

| # | Dor | Evidência / consequência |
|---|---|---|
| P1 | Não sei quanto gasto por mês com assinaturas | Soma de pequenos valores passa despercebida |
| P2 | Esqueço datas de cobrança e vencimento de fatura | Juros, multa, atraso |
| P3 | Não sei em qual cartão está cada assinatura | Dificulta cancelar, trocar de cartão ou renegociar |
| P4 | Testes gratuitos viram cobrança sem eu perceber | Pagamento de serviços não utilizados |
| P5 | Parcelamentos comprometem faturas futuras sem visibilidade | Surpresa no orçamento dos próximos meses |
| P6 | Apps bancários mostram só um cartão por vez | Sem visão consolidada |

## 3. Objetivos e métricas

### 3.1 Objetivos de produto

1. **O1 — Visão consolidada:** o usuário vê o total mensal comprometido de todos os cartões em uma tela.
2. **O2 — Previsibilidade:** o usuário vê a fatura projetada dos próximos 12 meses por cartão.
3. **O3 — Zero surpresa:** o usuário é avisado antes de cada cobrança relevante e de cada vencimento.
4. **O4 — Ação rápida:** cadastrar uma assinatura leva menos de 30 segundos.

### 3.2 Métricas de sucesso (KPIs)

| Métrica | Meta (90 dias pós-lançamento) |
|---|---|
| Ativação: usuário cria ≥1 cartão e ≥3 assinaturas na 1ª sessão | ≥ 60% dos cadastros |
| Retenção D30 | ≥ 35% |
| Faturas marcadas como pagas no prazo (entre usuários ativos) | ≥ 80% |
| Tempo médio para cadastrar assinatura | ≤ 30 s |
| Taxa de abertura de e-mails de lembrete | ≥ 40% |
| NPS | ≥ 40 |

### 3.3 Não-objetivos (fora de escopo)

- Integração com bancos, Open Finance ou leitura de extratos (avaliar só após v2).
- Processamento de pagamentos reais ou emissão de cartões.
- Contabilidade empresarial, notas fiscais, impostos.
- Investimentos, metas de poupança, orçamento completo de receitas (pode virar módulo futuro).
- Aplicativo mobile nativo (o MVP é web responsivo / PWA).

## 4. Personas

### 4.1 Ana — "a assinante digital" (persona primária)
- 28 anos, desenvolvedora, 2 cartões de crédito, ~12 assinaturas (streaming, IA, nuvem, música, academia).
- **Quer:** saber o total mensal e cancelar o que não usa.
- **Frustração:** "Toda fatura tem uma cobrança que eu não lembro de ter assinado."

### 4.2 Carlos — "o organizador da casa"
- 41 anos, gerencia as contas da família, 4 cartões (dele, da esposa, adicional, loja).
- **Quer:** saber qual fatura vence quando e quanto vai sair do caixa no mês.
- **Frustração:** "Já paguei juros por esquecer o vencimento de um cartão que quase não uso."

### 4.3 Bia — "a freelancer"
- 33 anos, designer autônoma, separa cartão pessoal e cartão de trabalho.
- **Quer:** ver quanto gasta com ferramentas de trabalho para precificar projetos.
- **Frustração:** "Misturo despesas pessoais e profissionais e não sei meu custo fixo real."

## 5. Proposta de valor

> **"Monte seus cartões, cadastre suas assinaturas e veja suas faturas antes de elas chegarem."**

Diferenciais:
- **Modelo de fatura realista:** respeita dia de fechamento e vencimento de cada cartão — uma cobrança no dia 28 em um cartão que fecha no dia 25 entra na fatura do mês seguinte.
- **Projeção futura:** assinaturas + parcelas geram a fatura projetada dos próximos meses.
- **Privacidade por design:** nenhum dado bancário real.
- **Rápido:** catálogo de serviços populares com nome, ícone e preço sugerido.

## 6. Escopo funcional

### 6.1 MVP (v1.0)

| ID | Épico | Descrição resumida |
|---|---|---|
| E1 | Conta e autenticação | Cadastro/login via magic link e Google; perfil (nome, moeda padrão BRL, fuso horário) |
| E2 | Cartões virtuais | CRUD de cartões: apelido, cor/tema, bandeira (rótulo visual), últimos 4 dígitos *opcionais e fictícios*, limite, dia de fechamento, dia de vencimento; arquivar cartão |
| E3 | Assinaturas | CRUD: nome, valor, moeda, periodicidade (semanal, mensal, trimestral, semestral, anual), data da próxima cobrança, cartão, categoria, status (ativa, pausada, em teste, cancelada), data de fim do teste |
| E4 | Despesas avulsas e parceladas | Lançamento manual em um cartão, à vista ou em N parcelas |
| E5 | Faturas | Geração automática de faturas por cartão/ciclo; itens derivados de assinaturas, despesas e parcelas; status (aberta, fechada, paga, vencida); registro de pagamento (total ou parcial) |
| E6 | Dashboard | Total mensal comprometido, próximos vencimentos, uso de limite por cartão, gasto por categoria, top assinaturas |
| E7 | Lembretes | E-mail e notificação in-app: X dias antes do vencimento da fatura, antes de cobrança de assinatura, antes do fim de teste gratuito |
| E8 | Projeção | Linha do tempo dos próximos 12 meses por cartão e consolidada |
| E9 | Categorias | Categorias padrão + personalizadas (cor e ícone) |

### 6.2 v1.1 — Pós-MVP imediato
- Catálogo de serviços populares com logo e preço sugerido.
- Exportação CSV/PDF de faturas e assinaturas.
- Histórico de reajuste de preço da assinatura (com gráfico).
- PWA instalável + Web Push.
- Modo escuro.

### 6.3 v2 — Futuro
- Multimoeda com conversão (USD/EUR para assinaturas internacionais + IOF estimado).
- Espaços compartilhados (família): múltiplos usuários no mesmo conjunto de cartões, com papéis.
- Importação de fatura via CSV/OFX.
- Insights: "assinaturas que você não marca como usadas há 60 dias", sugestões de economia.
- Contas fixas não-cartão (boleto, Pix recorrente).

## 7. Histórias de usuário principais (MVP)

| ID | Como… | Quero… | Para… | Critério de aceite resumido |
|---|---|---|---|---|
| US01 | usuário novo | entrar com meu e-mail ou Google | começar sem criar senha | Magic link expira em 15 min; sessão persiste 30 dias |
| US02 | usuário | criar um cartão com fechamento dia 25 e vencimento dia 5 | modelar meu cartão real | Cartão aparece no dashboard com fatura atual aberta |
| US03 | usuário | cadastrar a Netflix de R$ 55,90 mensal no cartão X, cobrada todo dia 12 | saber o impacto na fatura | Item aparece na fatura correta respeitando o fechamento |
| US04 | usuário | marcar uma assinatura como "em teste até dd/mm" | não ser cobrado sem querer | Recebo alerta 3 dias antes do fim do teste |
| US05 | usuário | lançar uma compra de R$ 1.200 em 6x | ver o impacto nas próximas faturas | 6 parcelas de R$ 200 aparecem nas 6 faturas seguintes |
| US06 | usuário | ver a fatura do mês com todos os itens | conferir com a fatura real | Lista itens, total, status, datas de fechamento e vencimento |
| US07 | usuário | marcar a fatura como paga | manter meu controle em dia | Status "paga", data e valor do pagamento registrados |
| US08 | usuário | receber e-mail 3 dias antes do vencimento | não pagar juros | E-mail enviado uma única vez por fatura/lembrete |
| US09 | usuário | ver o total mensal de assinaturas por categoria | decidir o que cortar | Gráfico de rosca + lista ordenada por valor |
| US10 | usuário | trocar a assinatura de cartão | refletir mudança real | Próximas cobranças migram; faturas já fechadas não mudam |
| US11 | usuário | cancelar uma assinatura | parar de projetar cobranças | Status "cancelada", cobranças futuras removidas da projeção |
| US12 | usuário | ver projeção dos próximos 12 meses | planejar meu orçamento | Gráfico de barras por mês, empilhado por cartão |

## 8. Requisitos de experiência (UX)

- **Mobile-first**, responsivo de 360 px a desktop wide.
- Formulários curtos com valores padrão inteligentes (próxima cobrança = hoje, periodicidade = mensal, cartão = último usado).
- Valores monetários sempre formatados no padrão do locale (`R$ 1.234,56`).
- Cartões exibidos visualmente como "cartões" (cor/gradiente escolhido), facilitando reconhecimento.
- Estados vazios com chamada clara para ação ("Crie seu primeiro cartão").
- Acessibilidade WCAG 2.1 AA.
- Idioma: pt-BR no MVP, estrutura pronta para i18n (en-US em v1.1).

## 9. Modelo de negócio (hipótese)

| Plano | Preço | Limites |
|---|---|---|
| Free | R$ 0 | até 3 cartões, 15 assinaturas, lembretes por e-mail |
| Pro | ~R$ 9,90/mês | ilimitado, exportação, Web Push, histórico de preço, insights |
| Família (v2) | ~R$ 19,90/mês | Pro + espaço compartilhado até 5 membros |

> A monetização não faz parte do MVP; os limites devem existir no código como *feature flags* por plano para habilitação futura.

## 10. Premissas e restrições

- Moeda padrão BRL; datas no fuso horário do usuário (padrão `America/Sao_Paulo`).
- Uma única pessoa/equipe pequena desenvolvendo → priorizar stack com baixo custo operacional (ver [ARCHITECTURE.md](ARCHITECTURE.md)).
- Infraestrutura em free tier no MVP, custo alvo < US$ 25/mês até 1.000 usuários ativos.
- Conformidade LGPD: consentimento, exportação e exclusão de dados do usuário.

## 11. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Usuário digitar número real de cartão no campo "últimos 4 dígitos" | Média | Médio | Aceitar só 4 dígitos, campo opcional, aviso explícito na UI |
| Regras de fechamento/vencimento divergirem dos bancos reais (feriados, dia 31) | Alta | Médio | Regras documentadas no SRS (RN-03 a RN-06) + ajuste manual de datas da fatura |
| Lembretes duplicados ou não enviados | Média | Alto | Jobs idempotentes com tabela de envios e chave única |
| Baixa retenção após cadastro inicial | Alta | Alto | Lembretes de valor (resumo semanal), onboarding guiado |
| Custos de infra escalarem com e-mails | Baixa | Baixo | Resend free (3k/mês, 100/dia) só no beta fechado; plano Pro antes do beta aberto; resumo diário reduz volume |

## 12. Roadmap

| Fase | Duração estimada | Entregas |
|---|---|---|
| F0 — Fundação | 1 semana | Repo, CI, infra (Vercel+Neon), auth, design system base |
| F1 — Núcleo | 2–3 semanas | Cartões, assinaturas, categorias, despesas/parcelas |
| F2 — Faturas | 2 semanas | Motor de faturas, pagamentos, projeção |
| F3 — Engajamento | 1–2 semanas | Dashboard, lembretes, e-mails |
| F4 — Beta | 2 semanas | Testes com 10–20 usuários, ajustes, LGPD, observabilidade |
| v1.0 | — | Lançamento público |

## 13. Critérios de lançamento (Definition of Done do MVP)

- Todas as histórias US01–US12 aceitas.
- Cobertura de testes ≥ 80% no módulo de domínio de faturas (regras de ciclo).
- Testes E2E dos fluxos críticos: login, criar cartão, criar assinatura, ver fatura, pagar fatura.
- Lighthouse ≥ 90 em Performance, Acessibilidade e Boas práticas.
- Exportação e exclusão de conta funcionando (LGPD).
- Monitoramento de erros e alertas ativos.
