# FinFlow — Mapa de Fluxo

| Campo | Valor |
|---|---|
| Versão do documento | 1.0 |
| Data | 2026-11-04 |
| Documentos relacionados | [PRD](PRD.md) · [SRS](SRS.md) · [Arquitetura](ARCHITECTURE.md) |

> Diagramas em [Mermaid](https://mermaid.js.org/) — renderizam nativamente no GitHub, GitLab, VS Code (extensão) e Obsidian.

## Índice
1. [Mapa do site (navegação)](#1-mapa-do-site-navegação)
2. [Jornada: primeiro acesso e onboarding](#2-jornada-primeiro-acesso-e-onboarding)
3. [Fluxo: autenticação](#3-fluxo-autenticação)
4. [Fluxo: gerenciar cartões](#4-fluxo-gerenciar-cartões)
5. [Fluxo: cadastrar assinatura](#5-fluxo-cadastrar-assinatura)
6. [Fluxo: ciclo de vida da assinatura](#6-fluxo-ciclo-de-vida-da-assinatura)
7. [Fluxo: lançar despesa parcelada](#7-fluxo-lançar-despesa-parcelada)
8. [Fluxo: atribuição de cobrança à fatura](#8-fluxo-atribuição-de-cobrança-à-fatura)
9. [Fluxo: ciclo de vida da fatura](#9-fluxo-ciclo-de-vida-da-fatura)
10. [Fluxo: consultar e pagar fatura](#10-fluxo-consultar-e-pagar-fatura)
11. [Fluxo: job diário](#11-fluxo-job-diário)
12. [Fluxo: lembretes](#12-fluxo-lembretes)
13. [Fluxo: privacidade (exportar / excluir conta)](#13-fluxo-privacidade-exportar--excluir-conta)
14. [Linha do tempo de exemplo](#14-linha-do-tempo-de-exemplo)

---

## 1. Mapa do site (navegação)

```mermaid
flowchart TD
    L["/ Landing"] --> LOGIN["/login"]
    L --> TERMS["/termos · /privacidade"]
    LOGIN -->|1º acesso| ONB["/onboarding"]
    LOGIN -->|usuário existente| DASH
    ONB --> DASH["/dashboard"]

    subgraph APP["Área autenticada (sidebar / bottom nav)"]
        DASH
        CARDS["/cards"]
        SUBS["/subscriptions"]
        EXP["/expenses"]
        CAL["/calendar"]
        NOTIF["/notifications"]
        SET["/settings"]
    end

    DASH --> CARDS & SUBS & EXP & CAL & NOTIF
    CARDS --> CARD["/cards/[id]<br/>fatura atual + histórico"]
    CARDS --> CARDNEW["Modal: novo cartão"]
    CARD --> INV["/cards/[id]/invoices/[YYYY-MM]"]
    INV --> PAY["Modal: registrar pagamento"]
    INV --> ADJ["Modal: lançar ajuste"]
    INV <-->|◀ ▶| INV
    SUBS --> SUB["/subscriptions/[id]<br/>detalhes + histórico de preço"]
    SUBS --> SUBNEW["Sheet: nova assinatura"]
    EXP --> EXPNEW["Sheet: nova despesa"]
    SET --> SP["Perfil"]
    SET --> SN["Notificações"]
    SET --> SC["Categorias"]
    SET --> SPRIV["Privacidade<br/>exportar / excluir"]

    FAB(("+ Ação rápida<br/>(global)")) -.-> SUBNEW & EXPNEW & CARDNEW
```

**Navegação principal**
- **Desktop:** sidebar fixa (Dashboard, Cartões, Assinaturas, Despesas, Calendário) + sino de notificações + avatar (Configurações, Sair).
- **Mobile:** bottom nav com 4 itens (Início, Cartões, Assinaturas, Calendário) + botão flutuante **"+"** (nova assinatura / despesa / cartão).

---

## 2. Jornada: primeiro acesso e onboarding

```mermaid
journey
    title Primeiro acesso da Ana
    section Descoberta
      Chega na landing: 4: Ana
      Clica em "Começar grátis": 5: Ana
    section Cadastro
      Entra com Google: 5: Ana
    section Onboarding
      Cria cartão "Roxinho" (fecha 25, vence 5): 4: Ana
      Adiciona 5 assinaturas pelo catálogo: 4: Ana
      Mantém lembrete 3 dias antes: 5: Ana
    section Valor
      Vê R$ 287/mês em assinaturas no dashboard: 3: Ana
      Vê fatura de dezembro projetada: 5: Ana
```

```mermaid
flowchart TD
    A[Login concluído] --> B{Conta nova?}
    B -->|Não| DASH[Dashboard]
    B -->|Sim| C[Criar usuário<br/>+ categorias padrão<br/>+ preferências padrão]
    C --> S1["Passo 1/3 — Seu primeiro cartão<br/>apelido · cor · fechamento · vencimento"]
    S1 -->|Salvar| S2
    S1 -->|Pular| S2
    S2["Passo 2/3 — Suas assinaturas<br/>lista rápida: nome · valor · dia"] -->|Adicionar várias| S2
    S2 -->|Continuar / Pular| S3
    S3["Passo 3/3 — Lembretes<br/>vencimento: 3 dias antes ✓<br/>cobrança: 1 dia antes ✓<br/>resumo diário ☐"] --> D[Marcar onboarding concluído]
    D --> DASH
    S2 -.->|sem cartão criado| S1
```

---

## 3. Fluxo: autenticação

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant W as FinFlow (Web)
    participant A as Better Auth
    participant E as Resend
    participant G as Google

    alt Magic link
        U->>W: Informa e-mail em /login
        W->>A: signIn("email")
        A->>A: Rate limit (5/min) · gera token (15 min, uso único)
        A->>E: Envia e-mail com link
        E-->>U: "Seu link de acesso ao FinFlow"
        U->>W: Clica no link
        W->>A: Valida token
    else Google
        U->>W: "Entrar com Google"
        W->>G: OAuth redirect
        G-->>W: callback (code)
        W->>A: Troca code por perfil
    end
    A->>A: Cria/atualiza usuário · cria sessão (30 dias)
    A-->>W: Cookie de sessão HttpOnly
    W-->>U: Redireciona p/ /onboarding ou /dashboard
```

---

## 4. Fluxo: gerenciar cartões

```mermaid
flowchart TD
    START([Usuário em /cards]) --> ACT{Ação}

    ACT -->|Novo| N1[Formulário de cartão]
    N1 --> N2{Válido?<br/>apelido · dias 1–31 · last4 = 4 dígitos ou vazio}
    N2 -->|Não| N1
    N2 -->|Sim| N3{Limite do plano?<br/>RN-21}
    N3 -->|Excedido| N4[Aviso de upgrade]
    N3 -->|OK| N5[Salvar cartão<br/>criar fatura do ciclo atual]
    N5 --> END([Lista atualizada])

    ACT -->|Editar| E1[Alterar campos]
    E1 --> E2{Mudou fechamento<br/>ou vencimento?}
    E2 -->|Não| E5[Salvar]
    E2 -->|Sim| E3[Confirmar: afeta só faturas abertas e futuras]
    E3 --> E4[Recalcular datas das faturas OPEN<br/>reatribuir cobranças RN-07]
    E4 --> E5 --> END

    ACT -->|Arquivar| A1{Tem assinaturas<br/>ativas/teste/pausadas?}
    A1 -->|Sim| A2[Escolher: mover para outro cartão<br/>ou cancelar assinaturas]
    A2 --> A3
    A1 -->|Não| A3[archived_at = agora]
    A3 --> END

    ACT -->|Excluir| D1{Possui faturas<br/>com cobranças?}
    D1 -->|Sim| D2[Bloquear · sugerir arquivar]
    D1 -->|Não| D3[Excluir definitivamente] --> END
```

---

## 5. Fluxo: cadastrar assinatura

```mermaid
flowchart TD
    A(["Botão + Assinatura"]) --> B{Possui cartão ativo?}
    B -->|Não| B1[Criar cartão primeiro] --> B
    B -->|Sim| C[Formulário<br/>nome · valor · periodicidade<br/>próxima cobrança · cartão · categoria]
    C --> D{É teste gratuito?}
    D -->|Sim| D1[status = TRIAL<br/>informar fim do teste<br/>1ª cobrança = fim do teste]
    D -->|Não| D2[status = ACTIVE]
    D1 & D2 --> E{Validação Zod<br/>valor > 0 · data válida · cartão do usuário}
    E -->|Erro| C
    E -->|OK| F[Salvar assinatura<br/>billing_anchor_day = dia da próxima cobrança<br/>registrar preço inicial no histórico]
    F --> G{Próxima cobrança ≤ hoje?}
    G -->|Sim| H[Materializar ocorrências pendentes<br/>RN-11]
    G -->|Não| I[Apenas projeção]
    H & I --> J[Revalidar dashboard, cartão, faturas]
    J --> K(["Toast: Assinatura adicionada · +R$ X/mês"])
```

---

## 6. Fluxo: ciclo de vida da assinatura

```mermaid
stateDiagram-v2
    [*] --> TRIAL: criar como teste
    [*] --> ACTIVE: criar como ativa

    TRIAL --> ACTIVE: job diário — hoje = fim do teste
    TRIAL --> CANCELED: usuário cancela antes do fim

    ACTIVE --> PAUSED: pausar
    PAUSED --> ACTIVE: retomar (nova próxima cobrança)
    ACTIVE --> CANCELED: cancelar (data efetiva)
    PAUSED --> CANCELED: cancelar

    CANCELED --> [*]

    note right of ACTIVE
        Job diário materializa ocorrências ≤ hoje
        como charges e avança next_charge_date
    end note
    note right of PAUSED
        Sem materialização nem projeção
    end note
    note left of CANCELED
        Terminal. "Duplicar" cria nova assinatura
    end note
```

**Alterações em assinatura ativa**

```mermaid
flowchart LR
    A[Editar assinatura] --> B{O que mudou?}
    B -->|Valor| C[Novo registro em price_history<br/>effective_from = data escolhida]
    B -->|Cartão| D[Ocorrências futuras → novo cartão<br/>charges já materializadas ficam]
    B -->|Periodicidade / dia| E[Recalcular next_charge_date<br/>e billing_anchor_day]
    B -->|Nome / categoria / notas| F[Atualização simples]
    C & D & E & F --> G[Projeções refletem na hora<br/>faturas fechadas intactas]
```

---

## 7. Fluxo: lançar despesa parcelada

```mermaid
flowchart TD
    A(["Botão + Despesa"]) --> B[Descrição · valor total · data · cartão · categoria · parcelas 1–48]
    B --> C{Válido?}
    C -->|Não| B
    C -->|Sim| D[InstallmentSplitter RN-10<br/>base = floor V/N · resto na 1ª]
    D --> E[Para cada parcela k:<br/>data exibida = compra + k−1 meses]
    E --> F[invoiceFor compra, cartão, offset k−1<br/>fatura da 1ª parcela + k−1 ciclos · RN-06/RN-10]
    F --> G[get-or-create fatura do ciclo]
    G --> H[Inserir charge k/N]
    H --> I{Mais parcelas?}
    I -->|Sim| E
    I -->|Não| J[Recalcular total_cents das faturas afetadas<br/>na mesma transação]
    J --> K(["Toast: R$ 1.200 em 6x de R$ 200 · dez/26 → mai/27"])
```

---

## 8. Fluxo: atribuição de cobrança à fatura

Regra central do motor de faturas (RN-02 a RN-06).

```mermaid
flowchart TD
    A["Entrada: data da cobrança d<br/>cartão (closing_day C, due_day V)"] --> B["F = fechamento no mês de d<br/>(dia C ou último dia do mês — RN-02)"]
    B --> C{d < F ?}
    C -->|Sim| D[Fechamento da fatura = F]
    C -->|"Não (d ≥ F)"| E["Fechamento = fechamento do mês seguinte"]
    D & E --> G{V > C ?}
    G -->|Sim| H[Vencimento no mesmo mês do fechamento]
    G -->|Não| I[Vencimento no mês seguinte ao fechamento]
    H & I --> J["Mês de referência = YYYY-MM do vencimento<br/>Período = [fechamento anterior, fechamento)"]
    J --> K{Fatura do cartão + mês<br/>já existe?}
    K -->|Sim| L{Status permite<br/>nova cobrança?}
    K -->|Não| M[Criar fatura OPEN]
    L -->|"OPEN"| N[Anexar charge]
    L -->|"CLOSED/PAID/..."| O["Anexar e recalcular status<br/>(ex.: estorno, materialização atrasada)"]
    M --> N
```

---

## 9. Fluxo: ciclo de vida da fatura

```mermaid
stateDiagram-v2
    [*] --> OPEN: get-or-create (ciclo atual/futuro)

    OPEN --> CLOSED: job diário — hoje ≥ fechamento, total > 0
    OPEN --> PAID: job diário — fechamento com total = 0
    OPEN --> PAID: pagamento antecipado ≥ total

    CLOSED --> PAID: pagamento = saldo
    CLOSED --> PARTIALLY_PAID: pagamento < saldo
    PARTIALLY_PAID --> PAID: quitação do saldo
    CLOSED --> OVERDUE: job diário — hoje > vencimento, saldo > 0
    PARTIALLY_PAID --> OVERDUE: job diário — hoje > vencimento, saldo > 0
    OVERDUE --> PAID: quitação do saldo

    PAID --> OPEN: nova cobrança antes do fechamento
    PAID --> PARTIALLY_PAID: estorno de pagamento / nova cobrança após fechamento
    PARTIALLY_PAID --> CLOSED: exclusão de todos os pagamentos

    PAID --> [*]
```

| Status | Cor/ícone na UI | Ações disponíveis |
|---|---|---|
| `OPEN` | Azul · 🕒 "Aberta" | Ver itens, ajuste, pagamento antecipado, ajustar datas |
| `CLOSED` | Âmbar · 📄 "Fechada" | Pagar, ajuste |
| `PARTIALLY_PAID` | Âmbar · ◐ "Parcialmente paga" | Pagar saldo, desfazer pagamento |
| `OVERDUE` | Vermelho · ⚠ "Vencida" | Pagar, ajuste |
| `PAID` | Verde · ✓ "Paga" | Ver comprovante, desfazer pagamento |

---

## 10. Fluxo: consultar e pagar fatura

```mermaid
flowchart TD
    A([/cards/id]) --> B[Fatura atual em destaque<br/>total · vencimento · status]
    B --> C[Abrir fatura /invoices/YYYY-MM]
    C --> D[Lista de cobranças<br/>materializadas ● + previstas ○]
    D --> E{Ação}
    E -->|◀ ▶| F[Navegar mês anterior/próximo] --> D
    E -->|Registrar pagamento| G[Modal: valor sugerido = saldo · data = hoje]
    G --> H{valor ≤ saldo?}
    H -->|Não| G
    H -->|Sim| I[Transação: inserir payment<br/>paid_cents += valor<br/>InvoiceStateMachine RN-15]
    I --> J{saldo = 0?}
    J -->|Sim| K[Status PAID ✓]
    J -->|Não| L[Status PARTIALLY_PAID ◐]
    K & L --> M[Cancelar lembretes pendentes desta fatura<br/>se quitada]
    M --> N([Dashboard e cartão revalidados])
    E -->|Lançar ajuste| O[Valor ± · descrição] --> P[charge ADJUSTMENT<br/>recalcular total e status] --> D
```

---

## 11. Fluxo: job diário

```mermaid
flowchart TD
    CRON([Vercel Cron 03:00 UTC]) --> AUTH{Bearer CRON_SECRET<br/>válido?}
    AUTH -->|Não| X[401]
    AUTH -->|Sim| RUN[Criar job_run · início]
    RUN --> LOOP[Buscar próximo lote de 200 usuários ativos<br/>cursor por id]
    LOOP --> TZ["Calcular «hoje» no fuso do usuário RN-01"]

    TZ --> S1["1. TRIAL → ACTIVE<br/>trial_ends_on ≤ hoje"]
    S1 --> S2["2. Materializar ocorrências<br/>next_charge_date ≤ hoje (loop até > hoje)<br/>INSERT charge ON CONFLICT DO NOTHING"]
    S2 --> S3["3. Fechar faturas<br/>OPEN e closing_date ≤ hoje → CLOSED / PAID"]
    S3 --> S4["4. Marcar vencidas<br/>CLOSED/PARTIALLY_PAID, due_date < hoje, saldo > 0 → OVERDUE"]
    S4 --> S5["5. Garantir fatura OPEN do ciclo corrente<br/>para cada cartão ativo"]
    S5 --> S6["6. Reconciliar total_cents × Σ charges<br/>RN-16 · logar divergência"]

    S6 --> MORE{Mais usuários?}
    MORE -->|Sim| LOOP
    MORE -->|Não| FIN[Finalizar job_run · contadores]
    FIN --> SENTRY[Check-in Sentry Cron Monitor]

    S2 -.->|erro em 1 usuário| ERR[Registrar erro<br/>seguir próximo usuário]
    ERR -.-> MORE
```

> Cada passo é **idempotente** e processa *tudo pendente até hoje*, então uma execução perdida é recuperada automaticamente na seguinte (RNF-21).

---

## 12. Fluxo: lembretes

```mermaid
flowchart TD
    CRON([Cron de lembretes]) --> U[Usuários cujo horário local ∈ 08:00–09:00<br/>e email_enabled]
    U --> P[Ler preferências]
    P --> C1["Faturas com due_date = hoje + N<br/>e saldo > 0 → INVOICE_DUE"]
    P --> C2["Faturas OVERDUE desde ontem → INVOICE_OVERDUE"]
    P --> C3["Ocorrências de assinatura em hoje + N<br/>valor ≥ limiar → SUBSCRIPTION_CHARGE"]
    P --> C4["TRIAL com fim em hoje+3 ou hoje+1 → TRIAL_ENDING"]
    C1 & C2 & C3 & C4 --> INS["INSERT notification (IN_APP + EMAIL)<br/>ON CONFLICT DO NOTHING — RN-17"]
    INS --> NEW{Linhas novas?}
    NEW -->|Não| SKIP[Já enviado · ignorar]
    NEW -->|Sim| DIG{daily_digest?}
    DIG -->|Sim| AGG[Agrupar em 1 e-mail DAILY_DIGEST]
    DIG -->|Não| IND[E-mails individuais]
    AGG & IND --> SEND[Resend API<br/>com link de descadastro assinado]
    SEND --> OK{Sucesso?}
    OK -->|Sim| SENT[status = SENT · sent_at]
    OK -->|Não| RETRY[status = FAILED · retry até 3x com backoff]
```

**Exemplo de e-mail (INVOICE_DUE)**
> **Assunto:** Fatura do Roxinho vence em 3 dias — R$ 842,17
> Olá, Ana! A fatura de **dezembro** do cartão **Roxinho** vence em **05/12/2026**.
> Total: **R$ 842,17** · 9 assinaturas · 2 parcelas.
> [Ver fatura] · [Marcar como paga]

---

## 13. Fluxo: privacidade (exportar / excluir conta)

```mermaid
flowchart TD
    A([/settings/privacidade]) --> B{Ação}
    B -->|Exportar dados| C[GET /api/export · rate limit]
    C --> D[Gerar JSON: perfil, cartões, assinaturas,<br/>despesas, faturas, pagamentos, categorias]
    D --> E([Download finflow-export-YYYY-MM-DD.json])

    B -->|Excluir conta| F[Confirmação: digitar e-mail]
    F --> G{Confere?}
    G -->|Não| F
    G -->|Sim| H[deleted_at = agora<br/>revogar todas as sessões<br/>parar lembretes]
    H --> I["E-mail de confirmação<br/>«pode reativar em até 30 dias»"]
    I --> J([Logout])
    J -.-> K[Job purge semanal:<br/>deleted_at > 30 dias → DELETE CASCADE]
```

---

## 14. Linha do tempo de exemplo

Cartão **Roxinho** (fecha dia 25, vence dia 5) com Netflix (R$ 55,90, dia 12), Spotify (R$ 21,90, dia 28) e um notebook de R$ 1.200,00 em 6x comprado em 20/11/2026.

```mermaid
gantt
    title Faturas do cartão Roxinho
    dateFormat  YYYY-MM-DD
    axisFormat  %d/%m

    section Fatura dez/26
    Período (25/10 → 24/11)     :a1, 2026-10-25, 2026-11-25
    Fechamento 25/11            :milestone, 2026-11-25, 0d
    Vencimento 05/12            :crit, milestone, 2026-12-05, 0d

    section Fatura jan/27
    Período (25/11 → 24/12)     :a2, 2026-11-25, 2026-12-25
    Fechamento 25/12            :milestone, 2026-12-25, 0d
    Vencimento 05/01            :crit, milestone, 2027-01-05, 0d

    section Cobranças
    Spotify 28/10               :milestone, 2026-10-28, 0d
    Netflix 12/11               :milestone, 2026-11-12, 0d
    Notebook 1/6 em 20/11       :milestone, 2026-11-20, 0d
    Spotify 28/11               :milestone, 2026-11-28, 0d
    Netflix 12/12               :milestone, 2026-12-12, 0d
    Notebook 2/6 em 20/12       :milestone, 2026-12-20, 0d
```

| Fatura | Itens | Total |
|---|---|---|
| **dez/26** (vence 05/12) | Spotify 28/10 (21,90) · Netflix 12/11 (55,90) · Notebook 1/6 (200,00) | **R$ 277,80** |
| **jan/27** (vence 05/01) | Spotify 28/11 (21,90) · Netflix 12/12 (55,90) · Notebook 2/6 (200,00) | **R$ 277,80** |
| fev/27 … mai/27 | Spotify + Netflix + Notebook 3/6 … 6/6 | R$ 277,80 cada |
| jun/27 em diante | Spotify + Netflix | R$ 77,80 |
