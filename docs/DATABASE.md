# FinFlow — Modelagem de Banco de Dados

| Campo | Valor |
|---|---|
| Versão do documento | 1.0 |
| Data | 2026-11-04 |
| SGBD | PostgreSQL 16 (Neon, região `aws-sa-east-1`) |
| ORM | Prisma 7 (`prisma-client` + driver adapter) |
| Fonte da verdade | [`prisma/schema.prisma`](../prisma/schema.prisma) + [`prisma/sql/constraints.sql`](../prisma/sql/constraints.sql) |
| Documentos relacionados | [SRS §5](SRS.md#5-modelo-de-dados) · [Arquitetura de Software](SOFTWARE_ARCHITECTURE.md) · [API](API_SPEC.md) |

> Este documento detalha e **substitui** o diagrama resumido do SRS §5 em caso de divergência.

---

## 1. Convenções

| Item | Convenção | Exemplo |
|---|---|---|
| Tabelas | `snake_case`, plural | `subscription_price_history`, `invoices` |
| Colunas | `snake_case` | `closing_day`, `next_charge_date` |
| Modelos Prisma | `PascalCase` singular, campos `camelCase` (via `@@map`/`@map`) | `Invoice.referenceMonth` |
| Chave primária | `id UUID` (`gen_random_uuid()` / `uuid()` do Prisma) | — |
| Chaves estrangeiras | `<entidade>_id` | `card_id` |
| Dinheiro | `BIGINT` em **centavos**, sufixo `_cents`; moeda em `CHAR(3)` ISO 4217 | `amount_cents = 5590` → R$ 55,90 |
| Data de negócio | `DATE` (sem hora), interpretada no fuso do usuário | `due_date = 2026-12-05` |
| Timestamp técnico | `TIMESTAMPTZ(3)` em UTC, sufixo `_at` | `created_at`, `archived_at` |
| Data "efetiva" | `DATE`, sufixo `_on` | `canceled_on`, `paid_on` |
| Soft delete / arquivamento | `TIMESTAMPTZ` anulável | `archived_at`, `deleted_at` |
| Multi-tenant | **Toda** tabela de dados de usuário possui `user_id` (mesmo quando derivável por join) | `charges.user_id` |
| Constraints | `<tabela>_<regra>_chk` | `cards_last4_chk` |

**Por que `user_id` denormalizado em `invoices`, `charges` e `payments`?** Permite que **toda** consulta do repositório seja filtrada por `WHERE user_id = $1` sem joins, tornando o isolamento entre usuários simples de auditar (SRS R-04) e habilitando índices compostos `(user_id, …)`.

---

## 2. Diagrama entidade-relacionamento

### 2.1 Núcleo do domínio

```mermaid
erDiagram
    users ||--o{ cards : "possui"
    users ||--o{ categories : "possui"
    users ||--o{ subscriptions : "possui"
    users ||--o{ expenses : "possui"

    cards ||--o{ subscriptions : "cobra em"
    cards ||--o{ expenses : "cobra em"
    cards ||--o{ invoices : "gera"
    cards ||--o{ charges : "recebe"

    categories |o--o{ subscriptions : "classifica"
    categories |o--o{ expenses : "classifica"
    categories |o--o{ charges : "classifica"

    subscriptions ||--o{ subscription_price_history : "histórico de preço"
    subscriptions |o--o{ charges : "origina (SUBSCRIPTION)"
    expenses |o--o{ charges : "origina (INSTALLMENT)"

    invoices ||--o{ charges : "contém"
    invoices ||--o{ payments : "recebe"

    cards {
        uuid id PK
        uuid user_id FK
        varchar40 nickname
        varchar60 issuer "nullable"
        CardBrand brand
        char4 last4 "nullable · fictício"
        varchar20 color
        bigint limit_cents "nullable"
        smallint closing_day "1–31"
        smallint due_day "1–31"
        boolean is_default
        int sort_order
        timestamptz archived_at "nullable"
    }
    categories {
        uuid id PK
        uuid user_id FK
        varchar40 name "UK(user_id,name)"
        varchar20 color
        varchar40 icon
        boolean is_system
    }
    subscriptions {
        uuid id PK
        uuid user_id FK
        uuid card_id FK
        uuid category_id FK "nullable"
        varchar80 name
        bigint amount_cents "> 0"
        char3 currency
        BillingCycle cycle
        smallint billing_anchor_day "1–31"
        date next_charge_date
        SubscriptionStatus status
        date trial_ends_on "nullable"
        timestamptz paused_at "nullable"
        date canceled_on "nullable"
        varchar500 manage_url "nullable"
        varchar60 catalog_slug "nullable"
        text notes "nullable"
    }
    subscription_price_history {
        uuid id PK
        uuid subscription_id FK
        bigint amount_cents
        date effective_from "UK(subscription_id,effective_from)"
    }
    expenses {
        uuid id PK
        uuid user_id FK
        uuid card_id FK
        uuid category_id FK "nullable"
        varchar120 description
        bigint total_cents "> 0"
        smallint installments "1–48"
        date purchase_date
        text notes "nullable"
    }
    invoices {
        uuid id PK
        uuid user_id FK
        uuid card_id FK
        char7 reference_month "YYYY-MM · UK(card_id,reference_month)"
        date period_start
        date closing_date
        date due_date
        bigint total_cents "cache Σ charges"
        bigint paid_cents "cache Σ payments"
        InvoiceStatus status
        boolean dates_overridden
        timestamptz closed_at "nullable"
        timestamptz paid_at "nullable"
    }
    charges {
        uuid id PK
        uuid user_id FK
        uuid card_id FK
        uuid invoice_id FK
        ChargeSource source_type
        uuid subscription_id FK "nullable"
        uuid expense_id FK "nullable"
        smallint installment_number "nullable"
        smallint installment_total "nullable"
        date charge_date
        varchar160 description
        bigint amount_cents "≠ 0"
        uuid category_id FK "nullable"
    }
    payments {
        uuid id PK
        uuid user_id FK
        uuid invoice_id FK
        bigint amount_cents "> 0"
        date paid_on
        varchar200 note "nullable"
    }
```

### 2.2 Identidade, notificações e operação

```mermaid
erDiagram
    users ||--o{ sessions : "autentica"
    users ||--o{ accounts : "vincula OAuth"
    users ||--o{ consents : "aceita"
    users ||--o{ notifications : "recebe"
    users ||--o| notification_preferences : "configura"

    users {
        uuid id PK
        varchar254 email UK
        varchar80 name
        boolean email_verified
        varchar500 image "nullable"
        varchar64 timezone "default America/Sao_Paulo"
        char3 currency "default BRL"
        varchar10 locale "default pt-BR"
        Plan plan "default FREE"
        timestamptz onboarding_completed_at "nullable"
        timestamptz email_suppressed_at "nullable · bounce/complaint"
        timestamptz deleted_at "nullable · soft delete"
    }
    sessions {
        uuid id PK
        uuid user_id FK
        varchar255 token UK
        timestamptz expires_at
        varchar64 ip_address "nullable"
        varchar500 user_agent "nullable"
    }
    accounts {
        uuid id PK
        uuid user_id FK
        varchar64 provider_id "google"
        varchar255 account_id "UK(provider_id,account_id)"
        text access_token "nullable"
        text refresh_token "nullable"
        text id_token "nullable"
    }
    verifications {
        uuid id PK
        varchar254 identifier "e-mail"
        varchar255 value "token do magic link"
        timestamptz expires_at
    }
    consents {
        uuid id PK
        uuid user_id FK
        ConsentType type
        varchar20 version
        timestamptz accepted_at
        timestamptz revoked_at "nullable"
        char64 ip_hash "nullable · SHA-256"
    }
    notifications {
        uuid id PK
        uuid user_id FK
        NotificationType type
        NotificationChannel channel
        uuid entity_id "UK(user,type,entity,target_date,channel)"
        date target_date
        NotificationStatus status
        varchar160 title
        text body "nullable"
        jsonb payload "nullable"
        smallint attempts
        text last_error "nullable"
        varchar100 provider_message_id "nullable"
        timestamptz sent_at "nullable"
        timestamptz read_at "nullable"
    }
    notification_preferences {
        uuid user_id PK
        boolean email_enabled
        boolean in_app_enabled
        smallint invoice_due_days_before "0–10, default 3"
        smallint subscription_days_before "nullable = off, default 1"
        bigint subscription_min_cents "default 0"
        boolean trial_reminders
        boolean overdue_alerts
        boolean daily_digest
    }
    job_runs {
        uuid id PK
        JobName job
        JobStatus status
        timestamptz started_at
        timestamptz finished_at "nullable"
        jsonb stats "nullable"
        text error "nullable"
    }
    webhook_events {
        varchar100 id PK "id do evento no provedor"
        varchar32 provider
        varchar64 type
        timestamptz received_at
    }
```

> Todas as tabelas também possuem `created_at` e, quando mutáveis, `updated_at` (omitidos nos diagramas). `verifications`, `job_runs` e `webhook_events` não têm `user_id` (não pertencem a um usuário).

---

## 3. Dicionário de dados

Legenda: **N** = aceita nulo · **D** = default.

### 3.1 `users`
| Coluna | Tipo | N | D | Descrição |
|---|---|---|---|---|
| `id` | uuid | | `gen_random_uuid()` | PK |
| `email` | varchar(254) | | | Único. Normalizado em minúsculas pela aplicação |
| `name` | varchar(80) | | `''` | Nome de exibição |
| `email_verified` | boolean | | `false` | Preenchido pelo Better Auth no 1º login por magic link/Google |
| `image` | varchar(500) | ✓ | | Avatar (URL do Google) |
| `timezone` | varchar(64) | | `America/Sao_Paulo` | IANA TZ; base para "hoje" (RN-01) |
| `currency` | char(3) | | `BRL` | Moeda padrão |
| `locale` | varchar(10) | | `pt-BR` | Idioma/formatação |
| `plan` | enum `Plan` | | `FREE` | RN-21 |
| `onboarding_completed_at` | timestamptz | ✓ | | Nulo ⇒ redirecionar ao onboarding |
| `email_suppressed_at` | timestamptz | ✓ | | Bounce/complaint via webhook Resend ⇒ não enviar e-mails |
| `deleted_at` | timestamptz | ✓ | | Exclusão solicitada (RF-007); purge após 30 dias |

### 3.2 `cards`
| Coluna | Tipo | N | D | Descrição |
|---|---|---|---|---|
| `id` | uuid | | | PK |
| `user_id` | uuid | | | FK → `users` (CASCADE) |
| `nickname` | varchar(40) | | | Apelido, não vazio |
| `issuer` | varchar(60) | ✓ | | Emissor livre ("Nubank") |
| `brand` | enum `CardBrand` | | `OTHER` | Apenas rótulo visual |
| `last4` | char(4) | ✓ | | **Fictício**, exatamente 4 dígitos (`cards_last4_chk`) |
| `color` | varchar(20) | | `violet` | Token de cor da paleta da UI |
| `limit_cents` | bigint | ✓ | | Limite; nulo = não controlar |
| `closing_day` | smallint | | | 1–31 |
| `due_day` | smallint | | | 1–31 |
| `is_default` | boolean | | `false` | No máx. 1 por usuário (índice parcial) |
| `sort_order` | int | | `0` | Ordenação manual |
| `archived_at` | timestamptz | ✓ | | Arquivado ⇒ não recebe novas cobranças |

### 3.3 `categories`
| Coluna | Tipo | N | D | Descrição |
|---|---|---|---|---|
| `name` | varchar(40) | | | Único por usuário |
| `color` / `icon` | varchar | | | Token de cor / nome do ícone (lucide) |
| `is_system` | boolean | | `false` | `true` apenas para "Outros" (não pode ser excluída — destino de realocação, RF-071) |

### 3.4 `subscriptions`
| Coluna | Tipo | N | D | Descrição |
|---|---|---|---|---|
| `card_id` | uuid | | | FK → `cards` (NO ACTION) |
| `category_id` | uuid | ✓ | | FK → `categories` (NO ACTION) |
| `name` | varchar(80) | | | Ex.: "Netflix Padrão" |
| `amount_cents` | bigint | | | Valor **vigente** (> 0). Histórico em `subscription_price_history` |
| `currency` | char(3) | | `BRL` | v2: multimoeda |
| `cycle` | enum `BillingCycle` | | `MONTHLY` | Periodicidade |
| `billing_anchor_day` | smallint | | | Dia original da cobrança; evita "deriva" no dia 31 (RN-09) |
| `next_charge_date` | date | | | Próxima ocorrência **não materializada** |
| `status` | enum | | `ACTIVE` | RN-13 |
| `trial_ends_on` | date | ✓ | | Obrigatório se `TRIAL` |
| `paused_at` | timestamptz | ✓ | | Quando foi pausada |
| `canceled_on` | date | ✓ | | Obrigatório se `CANCELED`; nenhuma ocorrência ≥ esta data |
| `manage_url` | varchar(500) | ✓ | | Link para gerenciar/cancelar no serviço |
| `catalog_slug` | varchar(60) | ✓ | | Item do catálogo (v1.1) |
| `notes` | text | ✓ | | Observações |

### 3.5 `subscription_price_history`
| Coluna | Tipo | Descrição |
|---|---|---|
| `subscription_id` | uuid | FK (CASCADE) |
| `amount_cents` | bigint | Valor a partir de `effective_from` |
| `effective_from` | date | Único por assinatura. O 1º registro = data de criação |

Valor numa data `d` = registro com maior `effective_from ≤ d`.

### 3.6 `expenses`
| Coluna | Tipo | Descrição |
|---|---|---|
| `description` | varchar(120) | Ex.: "Notebook" |
| `total_cents` | bigint | Valor total (> 0) |
| `installments` | smallint | 1–48 |
| `purchase_date` | date | Data da compra = data da 1ª parcela |

### 3.7 `invoices`
| Coluna | Tipo | N | D | Descrição |
|---|---|---|---|---|
| `card_id` | uuid | | | FK → `cards` (NO ACTION) |
| `reference_month` | char(7) | | | `YYYY-MM` do vencimento (RN-04); único por cartão |
| `period_start` | date | | | = fechamento anterior (inclusivo) |
| `closing_date` | date | | | Fechamento (exclusivo no período, RN-05) |
| `due_date` | date | | | Vencimento |
| `total_cents` | bigint | | `0` | **Cache** de Σ `charges.amount_cents` (RN-16) |
| `paid_cents` | bigint | | `0` | **Cache** de Σ `payments.amount_cents` |
| `status` | enum | | `OPEN` | RN-15 |
| `dates_overridden` | boolean | | `false` | Datas ajustadas manualmente (RF-047) — não recalcular em RN-07 |
| `closed_at` / `paid_at` | timestamptz | ✓ | | Auditoria de transições |

### 3.8 `charges`
| Coluna | Tipo | N | Descrição |
|---|---|---|---|
| `invoice_id` | uuid | | FK → `invoices` (CASCADE) |
| `card_id` | uuid | | Redundante com a fatura; facilita consultas por cartão |
| `source_type` | enum | | `SUBSCRIPTION` · `INSTALLMENT` · `ADJUSTMENT` |
| `subscription_id` | uuid | ✓ | Obrigatório se `SUBSCRIPTION`; FK NO ACTION |
| `expense_id` | uuid | ✓ | Obrigatório se `INSTALLMENT`; FK CASCADE |
| `installment_number` / `installment_total` | smallint | ✓ | `k` e `N` da parcela |
| `charge_date` | date | | Data da ocorrência/parcela |
| `description` | varchar(160) | | Snapshot: "Netflix", "Notebook (2/6)" |
| `amount_cents` | bigint | | > 0, exceto `ADJUSTMENT` (≠ 0, negativo = crédito) |
| `category_id` | uuid | ✓ | Snapshot da categoria no momento do lançamento |

> `description`, `amount_cents` e `category_id` são **snapshots**: renomear uma assinatura ou mudar seu preço não altera cobranças já materializadas (faturas fechadas são imutáveis).

### 3.9 `payments`
| Coluna | Tipo | Descrição |
|---|---|---|
| `invoice_id` | uuid | FK (CASCADE) |
| `amount_cents` | bigint | > 0; a aplicação garante ≤ saldo (RF-044) |
| `paid_on` | date | Data informada pelo usuário |
| `note` | varchar(200) | Observação opcional |

### 3.10 `notifications`
| Coluna | Tipo | Descrição |
|---|---|---|
| `type` / `channel` | enum | Ver §4 |
| `entity_id` | uuid | Fatura ou assinatura alvo; para `DAILY_DIGEST`, o próprio `user_id` (evita NULL na chave única) |
| `target_date` | date | Data do evento lembrado (ex.: vencimento) — compõe a chave de idempotência |
| `status` | enum | `PENDING` → `SENT` / `FAILED` / `SKIPPED` |
| `title` / `body` / `payload` | | Conteúdo renderizado na central in-app; `payload` guarda valores para o template |
| `attempts` / `last_error` | | Retentativas (máx. 3 reenvios, RN-17) |
| `provider_message_id` | varchar(100) | ID do e-mail no Resend (correlação de webhooks) |
| `read_at` | timestamptz | Lida na central (in-app) |

### 3.11 Demais tabelas
| Tabela | Finalidade |
|---|---|
| `sessions`, `accounts`, `verifications` | Schema do **Better Auth** (sessões em banco, contas OAuth, tokens de magic link) |
| `consents` | Registro LGPD de aceite de Termos/Privacidade com versão e hash do IP |
| `notification_preferences` | 1:1 com `users`, criada no onboarding |
| `job_runs` | Auditoria de execuções de jobs (RNF-52) |
| `webhook_events` | Idempotência de webhooks recebidos (chave = id do evento do provedor) |

---

## 4. Enumerações

| Enum | Valores | Usado em |
|---|---|---|
| `Plan` | `FREE`, `PRO` | `users.plan` |
| `CardBrand` | `VISA`, `MASTERCARD`, `ELO`, `AMEX`, `HIPERCARD`, `OTHER` | `cards.brand` |
| `BillingCycle` | `WEEKLY`, `MONTHLY`, `QUARTERLY`, `SEMIANNUAL`, `YEARLY` | `subscriptions.cycle` |
| `SubscriptionStatus` | `TRIAL`, `ACTIVE`, `PAUSED`, `CANCELED` | `subscriptions.status` |
| `InvoiceStatus` | `OPEN`, `CLOSED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE` | `invoices.status` |
| `ChargeSource` | `SUBSCRIPTION`, `INSTALLMENT`, `ADJUSTMENT` | `charges.source_type` |
| `NotificationType` | `INVOICE_DUE`, `INVOICE_OVERDUE`, `SUBSCRIPTION_CHARGE`, `TRIAL_ENDING`, `DAILY_DIGEST` | `notifications.type` |
| `NotificationChannel` | `EMAIL`, `IN_APP`, `PUSH` | `notifications.channel` |
| `NotificationStatus` | `PENDING`, `SENT`, `FAILED`, `SKIPPED` | `notifications.status` |
| `ConsentType` | `TERMS`, `PRIVACY`, `MARKETING` | `consents.type` |
| `JobName` | `DAILY`, `REMINDERS`, `PURGE`, `BACKUP` | `job_runs.job` |
| `JobStatus` | `RUNNING`, `SUCCEEDED`, `PARTIAL`, `FAILED` | `job_runs.status` |

> Adicionar valor a um enum é uma migração segura (`ALTER TYPE … ADD VALUE`). **Remover** exige expand/contract (§9).

---

## 5. Relacionamentos e regras de exclusão

| FK | ON DELETE | Motivo |
|---|---|---|
| `*.user_id → users` | `CASCADE` | Purge LGPD remove tudo do usuário com um `DELETE FROM users` |
| `subscriptions.card_id`, `expenses.card_id`, `invoices.card_id`, `charges.card_id → cards` | `NO ACTION` | Cartão com histórico não pode ser apagado (RF-014); só arquivado |
| `*.category_id → categories` | `NO ACTION` | Aplicação realoca para "Outros" antes de excluir (RF-071) |
| `charges.subscription_id → subscriptions` | `NO ACTION` | Assinatura com cobranças não é apagada, apenas cancelada |
| `charges.expense_id → expenses` | `CASCADE` | Excluir despesa remove suas parcelas (RF-033) |
| `charges.invoice_id`, `payments.invoice_id → invoices` | `CASCADE` | Fatura só é removida em cascata do usuário |
| `subscription_price_history.subscription_id` | `CASCADE` | Histórico pertence à assinatura |
| `sessions`, `accounts`, `consents`, `notifications`, `notification_preferences → users` | `CASCADE` | — |

> **Por que `NO ACTION` e não `RESTRICT`?** `RESTRICT` é verificado imediatamente, linha a linha, e quebraria o `DELETE FROM users` em cascata (a ordem em que o Postgres apaga `cards` e `invoices` não é garantida). `NO ACTION` é verificado **ao fim do comando**, quando a cascata já removeu os dependentes — bloqueando a exclusão direta de um cartão com histórico, mas permitindo o purge do usuário. (Verificado no Postgres 16 — §13.)

---

## 6. Constraints e índices

### 6.1 Constraints de integridade
Definidas em [`prisma/sql/constraints.sql`](../prisma/sql/constraints.sql), anexadas à migração inicial:

| Constraint | Regra |
|---|---|
| `cards_closing_day_chk`, `cards_due_day_chk` | dias entre 1 e 31 |
| `cards_last4_chk` | `last4 IS NULL OR last4 ~ '^[0-9]{4}$'` (RNF-10) |
| `cards_one_default_per_user` (índice único parcial) | ≤ 1 cartão padrão ativo por usuário |
| `subscriptions_trial_chk` | `TRIAL ⇒ trial_ends_on NOT NULL` |
| `subscriptions_canceled_chk` | `CANCELED ⇒ canceled_on NOT NULL` |
| `expenses_installments_chk` | 1–48 parcelas |
| `invoices_ref_month_chk` | formato `YYYY-MM` válido |
| `invoices_dates_chk` | `period_start < closing_date ≤ due_date` |
| `charges_source_chk` | coerência entre `source_type`, FKs de origem, parcela e sinal do valor |
| `payments_amount_chk` | valor > 0 |
| `prefs_*_chk` | faixas das preferências (0–10 dias) |

### 6.2 Índices e consultas atendidas

| Índice | Consulta atendida |
|---|---|
| `cards (user_id, archived_at)` | Listagem de cartões ativos |
| `invoices UNIQUE (card_id, reference_month)` | Get-or-create de fatura (RF-041) e navegação mês a mês |
| `invoices (user_id, due_date)` | Dashboard: faturas do mês, calendário |
| `invoices_pending_close` (parcial `status='OPEN'`) | Job diário: fechar faturas |
| `invoices_pending_due` (parcial `CLOSED/PARTIALLY_PAID`) | Job diário: marcar vencidas |
| `charges (invoice_id)` | Itens da fatura, reconciliação |
| `charges (user_id, charge_date)` | Gasto por categoria/período |
| `charges UNIQUE (subscription_id, charge_date)` | Idempotência da materialização (RN-11) |
| `charges UNIQUE (expense_id, installment_number)` | Uma linha por parcela |
| `subscriptions_live_next_charge` (parcial `ACTIVE/TRIAL`) | Job diário: materializar ocorrências vencidas |
| `subscriptions (status, trial_ends_on)` | Conversão de testes, lembretes de fim de teste |
| `notifications UNIQUE (user_id, type, entity_id, target_date, channel)` | Idempotência de lembretes (RN-17) |
| `notifications (user_id, channel, read_at)` | Contador de não lidas do sino |
| `notifications_retry_queue` (parcial `FAILED`) | Reenvio de e-mails falhos |

---

## 7. Consultas principais

Todas as consultas abaixo foram executadas contra o schema real em PostgreSQL 16 (ver §13). Na aplicação, a maioria é escrita com o Prisma Client; as marcadas com **(raw)** usam `prisma.$queryRaw`/`$executeRaw` com parâmetros tipados (TypedSQL).

### Q1 — Itens de uma fatura
```sql
SELECT c.charge_date, c.description, c.source_type, c.installment_number,
       c.installment_total, c.amount_cents, cat.name AS category
FROM charges c
LEFT JOIN categories cat ON cat.id = c.category_id
WHERE c.user_id = $1 AND c.invoice_id = $2
ORDER BY c.charge_date, c.created_at;
```

### Q2 — Total comprometido no mês (dashboard, RF-050)
```sql
SELECT COALESCE(SUM(i.total_cents), 0)                AS total_cents,
       COALESCE(SUM(i.total_cents - i.paid_cents), 0) AS open_balance_cents
FROM invoices i
WHERE i.user_id = $1
  AND i.due_date >= date_trunc('month', $2::date)
  AND i.due_date <  date_trunc('month', $2::date) + interval '1 month';
```
> Para faturas `OPEN`/futuras, a camada de aplicação soma as **ocorrências projetadas** de assinaturas (ProjectionEngine), que não estão no banco.

### Q3 — Gasto por categoria no mês (RF-054)
```sql
SELECT COALESCE(cat.name, 'Outros') AS category, cat.color,
       SUM(c.amount_cents) AS total_cents
FROM charges c
JOIN invoices i ON i.id = c.invoice_id
LEFT JOIN categories cat ON cat.id = c.category_id
WHERE c.user_id = $1 AND i.reference_month = $2
GROUP BY cat.name, cat.color
ORDER BY total_cents DESC;
```

### Q4 — Limite utilizado por cartão (RN-14) **(raw)**
```sql
SELECT k.id, k.nickname, k.limit_cents,
       COALESCE(SUM(c.amount_cents) FILTER (WHERE i.status IN ('OPEN','CLOSED','PARTIALLY_PAID','OVERDUE')), 0)
     - COALESCE((SELECT SUM(p.amount_cents) FROM payments p
                 JOIN invoices ip ON ip.id = p.invoice_id
                 WHERE ip.card_id = k.id AND ip.status IN ('OPEN','CLOSED','PARTIALLY_PAID','OVERDUE')), 0)
       AS used_cents
FROM cards k
LEFT JOIN invoices i ON i.card_id = k.id
LEFT JOIN charges  c ON c.invoice_id = i.id
WHERE k.user_id = $1 AND k.archived_at IS NULL
GROUP BY k.id;
```
> Inclui parcelas futuras (já persistidas em faturas `OPEN` futuras) e exclui ocorrências projetadas de assinaturas, como define a RN-14.

### Q5 — Lançar cobrança mantendo o cache da fatura (RN-16)
```sql
WITH ins AS (
  INSERT INTO charges (id, user_id, card_id, invoice_id, source_type, subscription_id,
                       charge_date, description, amount_cents, category_id, updated_at)
  VALUES (gen_random_uuid(), $1, $2, $3, 'SUBSCRIPTION', $4, $5, $6, $7, $8, now())
  ON CONFLICT (subscription_id, charge_date) DO NOTHING
  RETURNING amount_cents
)
UPDATE invoices
SET total_cents = total_cents + (SELECT COALESCE(SUM(amount_cents), 0) FROM ins),
    updated_at  = now()
WHERE id = $3;
```
> Uma única instrução: se a ocorrência já foi materializada, o `INSERT` não retorna linha e o total recebe `+0` (idempotente). O incremento atômico (`total_cents = total_cents + x`) evita *lost update* sem lock explícito. Na mesma transação, a aplicação avança `subscriptions.next_charge_date`.

### Q6 — Registrar pagamento com verificação de saldo (RF-044) **(raw)**
```sql
BEGIN;
SELECT total_cents, paid_cents, status
FROM invoices WHERE id = $1 AND user_id = $2
FOR UPDATE;                                   -- serializa pagamentos concorrentes da mesma fatura
-- aplicação: valida amount ≤ total - paid; calcula novo status (InvoiceStateMachine)
INSERT INTO payments (id, user_id, invoice_id, amount_cents, paid_on)
VALUES (gen_random_uuid(), $2, $1, $3, $4);
UPDATE invoices SET paid_cents = paid_cents + $3, status = $5,
       paid_at = CASE WHEN $5 = 'PAID' THEN now() END, updated_at = now()
WHERE id = $1;
COMMIT;
```

### Q7 — Job diário: fechar faturas, respeitando o fuso de cada usuário **(raw)**
```sql
UPDATE invoices i
SET status = CASE
               WHEN i.total_cents <= 0 OR i.paid_cents >= i.total_cents THEN 'PAID'::"InvoiceStatus"
               WHEN i.paid_cents > 0                                     THEN 'PARTIALLY_PAID'::"InvoiceStatus"
               ELSE 'CLOSED'::"InvoiceStatus"
             END,
    closed_at = now(), updated_at = now()
FROM users u
WHERE u.id = i.user_id
  AND u.deleted_at IS NULL
  AND i.status = 'OPEN'
  AND i.closing_date <= (now() AT TIME ZONE u.timezone)::date
  AND i.user_id = ANY($1::uuid[])            -- lote de usuários
RETURNING i.id, i.status;
```

### Q8 — Job diário: marcar vencidas **(raw)**
```sql
UPDATE invoices i
SET status = 'OVERDUE', updated_at = now()
FROM users u
WHERE u.id = i.user_id
  AND i.status IN ('CLOSED', 'PARTIALLY_PAID')
  AND i.due_date < (now() AT TIME ZONE u.timezone)::date
  AND i.total_cents > i.paid_cents
  AND i.user_id = ANY($1::uuid[]);
```

### Q9 — Job diário: assinaturas com ocorrências a materializar
```sql
SELECT s.*
FROM subscriptions s
JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL
WHERE s.status = 'ACTIVE'
  AND s.next_charge_date <= (now() AT TIME ZONE u.timezone)::date
  AND s.user_id = ANY($1::uuid[])
ORDER BY s.user_id, s.next_charge_date;
```

### Q10 — Lembretes de vencimento (RF-060)
```sql
SELECT i.id, i.user_id, i.due_date, i.total_cents - i.paid_cents AS balance_cents,
       k.nickname, u.email, u.name
FROM invoices i
JOIN cards k                     ON k.id = i.card_id
JOIN users u                     ON u.id = i.user_id
JOIN notification_preferences np ON np.user_id = u.id
WHERE u.deleted_at IS NULL
  AND u.email_suppressed_at IS NULL
  AND np.email_enabled
  AND i.status IN ('OPEN', 'CLOSED', 'PARTIALLY_PAID')
  AND i.total_cents > i.paid_cents
  AND i.due_date = (now() AT TIME ZONE u.timezone)::date + np.invoice_due_days_before
  AND u.id = ANY($1::uuid[]);
```
Seguido de `INSERT INTO notifications … ON CONFLICT DO NOTHING RETURNING id` — só envia o que foi efetivamente inserido (RN-17).

### Q11 — Reconciliação de caches (RN-16)
```sql
SELECT i.id, i.total_cents, COALESCE(SUM(c.amount_cents), 0) AS real_total
FROM invoices i
LEFT JOIN charges c ON c.invoice_id = i.id
WHERE i.user_id = ANY($1::uuid[])
GROUP BY i.id
HAVING i.total_cents <> COALESCE(SUM(c.amount_cents), 0);
```

---

## 8. Conexão, tipos e Prisma 7

### 8.1 Conexões

| Uso | Variável | Endpoint Neon | Observação |
|---|---|---|---|
| Aplicação (runtime serverless) | `DATABASE_URL` | **pooled** (`-pooler`, PgBouncer em modo transaction) | Via driver adapter `@prisma/adapter-neon` (WebSocket/HTTP) |
| Migrações, seed, scripts | `DIRECT_URL` | **direto** | Lido em `prisma.config.ts`; DDL e advisory locks não funcionam via PgBouncer transaction mode |
| Desenvolvimento local | ambos → `postgresql://finflow:finflow@localhost:5432/finflow` | Docker Compose | Adapter `@prisma/adapter-pg` |

```ts
// src/shared/infrastructure/db.ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/shared/config/env";

const adapter = env.DATABASE_URL.includes("neon.tech")
  ? new PrismaNeon({ connectionString: env.DATABASE_URL })
  : new PrismaPg({ connectionString: env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 8.2 Mapeamento de tipos

| Postgres | Prisma | TypeScript (Prisma Client) | Domínio FinFlow | Regra de conversão |
|---|---|---|---|---|
| `bigint` (`*_cents`) | `BigInt` | `bigint` | `Money` (`{ cents: bigint, currency }`) | Conversão feita no repositório. Para DTOs enviados ao cliente: `number` (seguro até 2⁵³ centavos ≈ R$ 90 trilhões) |
| `date` | `DateTime @db.Date` | `Date` (00:00 UTC) | `DateOnly` (`"YYYY-MM-DD"`) | `toDateOnly(d) = d.toISOString().slice(0,10)`; **nunca** usar `getDate()` local |
| `timestamptz` | `DateTime` | `Date` | `Date` / `Instant` | UTC |
| `smallint` | `Int @db.SmallInt` | `number` | `number` | — |
| `jsonb` | `Json` | `JsonValue` | DTO validado com Zod | Validar ao ler |
| enums | enum | union de strings | union de strings | — |

---

## 9. Migrações

### 9.1 Fluxo
```mermaid
flowchart LR
    A[Editar schema.prisma] --> B["pnpm prisma migrate dev --create-only --name x"]
    B --> C[Revisar SQL gerado<br/>+ adicionar SQL manual se preciso]
    C --> D["pnpm prisma migrate dev<br/>(aplica local + gera client)"]
    D --> E[PR: CI aplica em branch Neon efêmero]
    E --> F["merge → prisma migrate deploy<br/>em produção (DIRECT_URL)"]
```

### 9.2 Regras
1. **Migração inicial** = SQL gerado pelo Prisma + conteúdo de `prisma/sql/constraints.sql` + `CREATE EXTENSION IF NOT EXISTS pgcrypto` (Postgres < 13 apenas; no 16 `gen_random_uuid()` é nativo).
2. **Expand → migrate → contract** para mudanças incompatíveis (renomear/remover coluna, mudar tipo, remover valor de enum): (1) adicionar o novo, (2) dual-write + backfill, (3) remover o antigo em release posterior.
3. Índices em tabelas grandes: `CREATE INDEX CONCURRENTLY` em migração separada (sem transação).
4. Proibido editar migração já aplicada em produção.
5. Toda migração precisa passar no CI contra um branch Neon com cópia dos dados de produção (anonimizado no futuro).

### 9.3 Seed (`prisma/seed.ts`)
- **Categorias padrão** (RF-070): criadas por usuário no onboarding (função `seedUserDefaults(userId)`), não globalmente.
- **Ambiente de desenvolvimento**: usuário `demo@finflow.local` com 3 cartões, 12 assinaturas, 4 despesas parceladas e 6 meses de histórico de faturas e pagamentos.

---

## 10. Concorrência e transações

| Operação | Estratégia |
|---|---|
| Inserir/alterar/remover cobrança | Transação: DML na `charges` + `UPDATE invoices SET total_cents = total_cents ± x` (atômico) |
| Registrar/excluir pagamento | Transação com `SELECT … FOR UPDATE` na fatura (Q6) |
| Get-or-create de fatura | `INSERT … ON CONFLICT (card_id, reference_month) DO NOTHING` seguido de `SELECT` |
| Materialização de assinatura | `ON CONFLICT (subscription_id, charge_date) DO NOTHING` + avanço de `next_charge_date` na mesma transação |
| Lembretes | `INSERT … ON CONFLICT DO NOTHING RETURNING` antes do envio |
| Job concorrente consigo mesmo | `pg_try_advisory_lock(hashtext('job:daily'))` na conexão direta; se não obtiver, encerra |
| Edição concorrente pelo usuário (2 abas) | *Optimistic concurrency*: Server Actions de edição enviam `updatedAt`; `UPDATE … WHERE id = $1 AND updated_at = $2` → 0 linhas ⇒ erro `CONFLICT` |

Nível de isolamento: `READ COMMITTED` (padrão). As regras acima eliminam as anomalias relevantes sem exigir `SERIALIZABLE`.

---

## 11. Volumetria estimada

| Entidade | Por usuário ativo/ano | 1.000 usuários | 10.000 usuários |
|---|---|---|---|
| `cards` | 3 | 3 mil | 30 mil |
| `subscriptions` | 15 | 15 mil | 150 mil |
| `invoices` | 36 | 36 mil | 360 mil |
| `charges` | ~250 | 250 mil | 2,5 mi |
| `notifications` | ~150 | 150 mil | 1,5 mi |
| **Armazenamento (dados + índices)** | ~200 KB | **~200 MB** | **~2 GB** |

> O free tier do Neon (0,5 GB) comporta o primeiro ~1–2 mil usuários. `notifications` com mais de 180 dias e `job_runs`/`webhook_events` com mais de 90 dias são expurgados pelo job `purge`.

---

## 12. Retenção, LGPD e backup

| Dado | Retenção | Mecanismo |
|---|---|---|
| Conta excluída pelo usuário | 30 dias em soft delete, depois purge total | `users.deleted_at` + job `purge` (`DELETE FROM users` ⇒ CASCADE) |
| Notificações | 180 dias | job `purge` |
| `job_runs`, `webhook_events` | 90 dias | job `purge` |
| `sessions` expiradas | removidas diariamente | job `daily` |
| `verifications` expiradas | removidas diariamente | job `daily` |
| Backups lógicos (`pg_dump`) | 30 dias | GitHub Actions → Cloudflare R2 (ver [INTEGRATIONS.md](INTEGRATIONS.md#8-cloudflare-r2-backups)) |
| PITR do Neon | 24 h (free) / 7 dias (Launch) | Nativo |

- **Exportação LGPD** (RF-006): JSON com todas as tabelas do usuário, exceto `sessions`, `accounts.*_token` e `verifications`.
- **Dados sensíveis**: o FinFlow não armazena dado bancário real. Tokens OAuth em `accounts` são do provedor de login (Google) e podem ser descartados após o login (não usamos APIs do Google em nome do usuário).
- **Backups após purge**: dados de contas purgadas permanecem em backups por até 30 dias e depois expiram — informado na política de privacidade.

---

## 13. Verificação do schema

Antes de publicar este documento, o schema foi validado da seguinte forma:

1. `schema.prisma` validado pelo validador oficial do Prisma 7 (`@prisma/prisma-schema-wasm`): **válido**, 17 modelos.
2. DDL equivalente aplicado em **PostgreSQL 16.15** + `constraints.sql`: **sem erros**.
3. Consultas Q1–Q11 executadas com dados de exemplo (cartão com fechamento 25 / vencimento 5, assinaturas e parcelamento): resultados conferem com os exemplos de [FLOW_MAP §14](FLOW_MAP.md#14-linha-do-tempo-de-exemplo).
4. Constraints exercitadas: `last4 = '12a4'`, `closing_day = 32`, segundo cartão padrão, cobrança `SUBSCRIPTION` sem `subscription_id`, materialização duplicada e lembrete duplicado — **todas rejeitadas**.
5. `DELETE FROM cards` com faturas ⇒ **bloqueado** (NO ACTION); `DELETE FROM users` ⇒ **cascata completa** sem erro.

Reproduzir localmente após o scaffold: `docker compose up -d db && pnpm prisma migrate dev && pnpm test:db`.
