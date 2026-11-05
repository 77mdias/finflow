# FinFlow — Especificação de API

| Campo | Valor |
|---|---|
| Versão do documento | 1.0 |
| Data | 2026-11-04 |
| Contrato HTTP (máquina) | [`docs/api/openapi.yaml`](api/openapi.yaml) — OpenAPI 3.1 |
| Documentos relacionados | [SRS §6](SRS.md#6-interfaces-externas) · [Arquitetura de Software](SOFTWARE_ARCHITECTURE.md) · [Banco de Dados](DATABASE.md) · [Integrações](INTEGRATIONS.md) |

---

## 1. Superfícies de API

O FinFlow expõe **quatro superfícies**, com públicos e contratos diferentes:

| # | Superfície | Transporte | Consumidor | Contrato |
|---|---|---|---|---|
| A | **Server Actions** (escrita) | RPC do Next.js (POST interno) | Client Components do próprio app | §5 — schemas Zod + `ActionResult` |
| B | **Query services** (leitura) | Chamada direta em RSC (sem rede) | Server Components | §6 — assinaturas TypeScript + DTOs |
| C | **Route Handlers HTTP** | HTTPS/JSON | Vercel Cron, Resend (webhook), navegador (export, unsubscribe), monitor de uptime | §8 + [`openapi.yaml`](api/openapi.yaml) |
| D | **Auth** (`/api/auth/*`) | HTTPS/JSON | Cliente Better Auth no navegador | §9 — gerenciado pelo Better Auth |
| E | **REST v1** *(planejada, v2)* | HTTPS/JSON | App mobile, integrações de terceiros | §10 — mapeamento para os mesmos casos de uso |

> Server Actions e Query services **não são API pública**: seus endpoints internos não são estáveis entre deploys. Qualquer consumidor externo deve usar a REST v1 quando existir.

---

## 2. Convenções

| Tema | Convenção |
|---|---|
| Identificadores | UUID v4 em string (`"3f6c…"`) |
| Dinheiro (saída) | `{ "amountCents": 5590, "currency": "BRL" }` — inteiro em centavos. Campos terminam em `Cents` |
| Dinheiro (entrada de formulário) | String decimal pt-BR `"1.234,56"` → convertida para centavos no schema (`MoneyInput`). Nunca `float` |
| Data de negócio | `"YYYY-MM-DD"` (sem hora, sem fuso) |
| Timestamp | ISO 8601 UTC `"2026-11-04T14:03:22.120Z"` |
| Mês de referência | `"YYYY-MM"` |
| Enums | `UPPER_SNAKE_CASE`, idênticos ao banco |
| Nomes de campo | `camelCase` |
| Paginação | Cursor: `{ items, nextCursor }`; `limit` padrão 20, máx. 100 |
| Concorrência otimista | Mutations de edição recebem `expectedUpdatedAt`; divergência ⇒ `CONFLICT` |
| Idempotência | Criações aceitam `clientRequestId` (UUID gerado no formulário); repetição devolve o mesmo resultado (evita duplo clique) |
| Autorização | Recurso de outro usuário ⇒ `NOT_FOUND` (nunca `FORBIDDEN`, para não revelar existência) |
| Locale | Mensagens de erro em pt-BR; códigos de erro são estáveis e independentes de idioma |

### 2.1 Envelope de resultado das Server Actions

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

interface ActionError {
  code: ErrorCode;                          // estável — ver §3
  message: string;                          // pt-BR, exibível ao usuário
  fieldErrors?: Record<string, string[]>;   // apenas VALIDATION_ERROR
  requestId: string;                        // correlação com logs/Sentry
}
```

### 2.2 Envelope de erro HTTP (Route Handlers)

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Sessão expirada. Entre novamente.",
    "requestId": "8a1d0c9e-2b7f-4a8e-9a51-6f1f4b7b2c10"
  }
}
```
Header `X-Request-Id` presente em todas as respostas.

---

## 3. Modelo de erros

| Código | HTTP | Quando | Exemplo de mensagem |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | Sem sessão válida / segredo de cron inválido | "Sessão expirada. Entre novamente." |
| `NOT_FOUND` | 404 | Recurso inexistente **ou de outro usuário** | "Cartão não encontrado." |
| `VALIDATION_ERROR` | 422 | Falha no schema Zod | "Revise os campos destacados." |
| `CONFLICT` | 409 | `expectedUpdatedAt` divergente | "Este item foi alterado em outra aba. Atualize a página." |
| `RATE_LIMITED` | 429 | Limite excedido (header `Retry-After`) | "Muitas tentativas. Tente novamente em 1 minuto." |
| `PLAN_LIMIT_REACHED` | 403 | RN-21 com limites ativos | "O plano Free permite até 3 cartões." |
| `CARD_ARCHIVED` | 422 | Lançar em cartão arquivado | "Este cartão está arquivado." |
| `CARD_HAS_ACTIVE_SUBSCRIPTIONS` | 422 | Arquivar sem realocar assinaturas (RF-013) | "Mova ou cancele as 4 assinaturas deste cartão." |
| `CARD_HAS_HISTORY` | 422 | Excluir cartão com faturas (RF-014) | "Cartões com faturas só podem ser arquivados." |
| `INVALID_STATE_TRANSITION` | 422 | Transição proibida (RN-13), ex.: retomar `CANCELED` | "Assinaturas canceladas não podem ser retomadas." |
| `INVOICE_LOCKED` | 422 | Alterar parcela em fatura fechada/paga (RF-032) | "Há parcelas em faturas fechadas. Lance um ajuste." |
| `PAYMENT_EXCEEDS_BALANCE` | 422 | Pagamento > saldo (RF-044) | "O valor excede o saldo de R$ 177,80." |
| `CATEGORY_IS_SYSTEM` | 422 | Excluir "Outros" | "Esta categoria não pode ser excluída." |
| `SUBSCRIPTION_HAS_CHARGES` | 422 | Excluir assinatura com cobranças | "Cancele a assinatura em vez de excluí-la." |
| `INTERNAL` | 500 | Erro inesperado (reportado ao Sentry) | "Algo deu errado. Tente novamente." |

---

## 4. Rate limits

| Escopo | Limite | Chave |
|---|---|---|
| Solicitar magic link | 5/min e 20/dia | IP **e** e-mail (o mais restritivo) |
| Server Actions (geral) | 60/min | `userId` |
| `GET /api/export` | 3/hora | `userId` |
| `POST /api/unsubscribe` | 30/min | IP |
| Webhooks / cron | sem limite (autenticados por assinatura/segredo) | — |

Implementação: Upstash Ratelimit, janela deslizante. Resposta: `RATE_LIMITED` + `Retry-After` (segundos).

---

## 5. Server Actions (escrita)

Cada action é criada com o wrapper `action()` ([Arquitetura de Software §5.2](SOFTWARE_ARCHITECTURE.md#52-caminho-de-escrita-server-action)), que aplica em ordem: **autenticação → rate limit → validação → caso de uso em transação → `updateTag` → `ActionResult`**. Todas podem retornar `UNAUTHENTICATED`, `RATE_LIMITED`, `VALIDATION_ERROR` e `INTERNAL`, além dos erros listados.

### 5.1 Tipos de entrada compartilhados (Zod 4)

```ts
// src/shared/ui/schemas.ts
export const Id = z.uuid();
export const DateOnly = z.iso.date();                                   // "YYYY-MM-DD"
export const DayOfMonth = z.int().min(1).max(31);
export const MoneyInput = z.string().trim()
  .regex(/^\d{1,3}(\.?\d{3})*(,\d{1,2})?$/, "Valor inválido")
  .transform(toCents)                                                   // "1.234,5" → 123450n
  .refine((c) => c > 0n && c <= 100_000_000_00n, "Valor fora do intervalo");
export const SignedMoneyInput = z.string().trim().regex(/^-?\d{1,3}(\.?\d{3})*(,\d{1,2})?$/).transform(toCents)
  .refine((c) => c !== 0n, "Valor não pode ser zero");
export const OptionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
export const ExpectedUpdatedAt = z.iso.datetime();
export const ClientRequestId = z.uuid().optional();
```

### 5.2 Cartões — `modules/cards`

| Action | Entrada | Saída | Erros específicos | Requisitos |
|---|---|---|---|---|
| `createCard` | `CardInput` + `clientRequestId?` | `CardDTO` | `PLAN_LIMIT_REACHED` | RF-010, RF-011 |
| `updateCard` | `{ id, expectedUpdatedAt, ...Partial<CardInput> }` | `CardDTO` + `{ invoicesRecalculated: number }` | `NOT_FOUND`, `CONFLICT` | RF-012, RN-07 |
| `setDefaultCard` | `{ id }` | `CardDTO` | `NOT_FOUND`, `CARD_ARCHIVED` | RF-016 |
| `archiveCard` | `{ id, reassignTo?: Id, cancelSubscriptions?: boolean }` | `{ archived: true, moved: number, canceled: number }` | `NOT_FOUND`, `CARD_HAS_ACTIVE_SUBSCRIPTIONS` | RF-013 |
| `unarchiveCard` | `{ id }` | `CardDTO` | `NOT_FOUND`, `PLAN_LIMIT_REACHED` | — |
| `deleteCard` | `{ id }` | `{ deleted: true }` | `NOT_FOUND`, `CARD_HAS_HISTORY` | RF-014 |
| `reorderCards` | `{ ids: Id[] }` | `{ ok: true }` | — | RF-017 (C) |

```ts
export const CardInput = z.object({
  nickname: z.string().trim().min(1).max(40),
  issuer: OptionalText(60),
  brand: z.enum(["VISA", "MASTERCARD", "ELO", "AMEX", "HIPERCARD", "OTHER"]).default("OTHER"),
  last4: z.string().regex(/^\d{4}$/, "Use exatamente 4 dígitos").optional(),   // fictício (RF-011)
  color: z.enum(CARD_COLORS),
  limit: MoneyInput.optional(),
  closingDay: DayOfMonth,
  dueDay: DayOfMonth,
});
```

**Efeitos colaterais:** `createCard` cria a fatura `OPEN` do ciclo corrente. `updateCard` com novo `closingDay`/`dueDay` recalcula datas de faturas `OPEN` sem `datesOverridden` e reatribui suas cobranças (RN-07) na mesma transação.

### 5.3 Categorias — `modules/categories`

| Action | Entrada | Saída | Erros |
|---|---|---|---|
| `createCategory` | `{ name: 1–40, color, icon }` | `CategoryDTO` | `VALIDATION_ERROR` (nome duplicado ⇒ `fieldErrors.name`) |
| `updateCategory` | `{ id, name?, color?, icon? }` | `CategoryDTO` | `NOT_FOUND` |
| `deleteCategory` | `{ id }` | `{ reassigned: number }` | `NOT_FOUND`, `CATEGORY_IS_SYSTEM` |

`deleteCategory` move assinaturas, despesas **e cobranças** para "Outros" antes de excluir (RF-071).

### 5.4 Assinaturas — `modules/subscriptions`

| Action | Entrada | Saída | Erros específicos | Requisitos |
|---|---|---|---|---|
| `createSubscription` | `SubscriptionInput` + `clientRequestId?` | `SubscriptionDTO` + `{ materialized: number }` | `NOT_FOUND` (cartão), `CARD_ARCHIVED`, `PLAN_LIMIT_REACHED` | RF-020, RF-026 |
| `updateSubscription` | `{ id, expectedUpdatedAt, name?, categoryId?, cycle?, nextChargeDate?, manageUrl?, notes? }` | `SubscriptionDTO` | `NOT_FOUND`, `CONFLICT`, `INVALID_STATE_TRANSITION` (se `CANCELED`) | RF-020 |
| `changeSubscriptionPrice` | `{ id, amount: MoneyInput, effectiveFrom: DateOnly }` | `SubscriptionDTO` | `NOT_FOUND` | RF-024 |
| `changeSubscriptionCard` | `{ id, cardId: Id }` | `SubscriptionDTO` | `NOT_FOUND`, `CARD_ARCHIVED` | RF-023 |
| `pauseSubscription` | `{ id }` | `SubscriptionDTO` | `INVALID_STATE_TRANSITION` | RF-022, RN-13 |
| `resumeSubscription` | `{ id, nextChargeDate: DateOnly }` | `SubscriptionDTO` | `INVALID_STATE_TRANSITION` | RF-022 |
| `cancelSubscription` | `{ id, effectiveOn: DateOnly }` | `SubscriptionDTO` | `INVALID_STATE_TRANSITION` | RF-022 |
| `duplicateSubscription` | `{ id }` | `SubscriptionDTO` (nova, `ACTIVE`) | `NOT_FOUND`, `PLAN_LIMIT_REACHED` | RN-13 |
| `deleteSubscription` | `{ id }` | `{ deleted: true }` | `SUBSCRIPTION_HAS_CHARGES` | — |

```ts
export const SubscriptionInput = z.object({
  name: z.string().trim().min(1).max(80),
  amount: MoneyInput,
  cycle: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "YEARLY"]).default("MONTHLY"),
  nextChargeDate: DateOnly,
  cardId: Id,
  categoryId: Id.optional(),
  status: z.enum(["ACTIVE", "TRIAL"]).default("ACTIVE"),
  trialEndsOn: DateOnly.optional(),
  manageUrl: z.url({ protocol: /^https?$/ }).max(500).optional(),
  notes: OptionalText(2000),
  catalogSlug: z.string().max(60).optional(),
}).refine((s) => s.status !== "TRIAL" || !!s.trialEndsOn,
          { path: ["trialEndsOn"], message: "Informe o fim do teste" });
```

**Efeitos colaterais:** `billingAnchorDay` = dia de `nextChargeDate` (ou de `trialEndsOn` para `TRIAL`); 1º registro em `subscription_price_history`; se `nextChargeDate ≤ hoje`, materializa ocorrências pendentes (RN-11) imediatamente.

### 5.5 Despesas — `modules/expenses`

| Action | Entrada | Saída | Erros específicos | Requisitos |
|---|---|---|---|---|
| `createExpense` | `ExpenseInput` + `clientRequestId?` | `ExpenseDTO` com `installments: { number, date, referenceMonth, amountCents }[]` | `NOT_FOUND`, `CARD_ARCHIVED` | RF-030, RF-031, RN-10 |
| `updateExpense` | `{ id, expectedUpdatedAt, ...Partial<ExpenseInput> }` | `ExpenseDTO` | `CONFLICT`, `INVOICE_LOCKED` | RF-032 |
| `deleteExpense` | `{ id, confirmClosedInvoices?: boolean }` | `{ deleted: true, affectedInvoices: string[] }` | `INVOICE_LOCKED` (sem confirmação) | RF-033 |

```ts
export const ExpenseInput = z.object({
  description: z.string().trim().min(1).max(120),
  total: MoneyInput,
  purchaseDate: DateOnly,
  cardId: Id,
  categoryId: Id.optional(),
  installments: z.int().min(1).max(48).default(1),
  notes: OptionalText(2000),
});
```

### 5.6 Faturas — `modules/invoices`

| Action | Entrada | Saída | Erros específicos | Requisitos |
|---|---|---|---|---|
| `registerPayment` | `{ invoiceId, amount: MoneyInput, paidOn: DateOnly, note?: ≤200 }` | `InvoiceSummaryDTO` | `NOT_FOUND`, `PAYMENT_EXCEEDS_BALANCE` | RF-044, RN-15 |
| `deletePayment` | `{ paymentId }` | `InvoiceSummaryDTO` | `NOT_FOUND` | RF-045 |
| `createAdjustment` | `{ invoiceId, amount: SignedMoneyInput, description: 1–160, categoryId? }` | `InvoiceSummaryDTO` | `NOT_FOUND` | RF-034 |
| `deleteAdjustment` | `{ chargeId }` | `InvoiceSummaryDTO` | `NOT_FOUND` (inclui charge que não é `ADJUSTMENT`) | RF-034 |
| `overrideInvoiceDates` | `{ invoiceId, closingDate: DateOnly, dueDate: DateOnly }` | `InvoiceSummaryDTO` | `NOT_FOUND`, `INVOICE_LOCKED` (não `OPEN`), `VALIDATION_ERROR` (`closing ≤ due`) | RF-047 |
| `resetInvoiceDates` | `{ invoiceId }` | `InvoiceSummaryDTO` | `NOT_FOUND`, `INVOICE_LOCKED` | RF-047 |

`registerPayment` executa `SELECT … FOR UPDATE` na fatura ([DATABASE Q6](DATABASE.md#q6--registrar-pagamento-com-verificação-de-saldo-rf-044-raw)), recalcula o status com `nextStatus()` e, se quitada, marca lembretes `PENDING` dessa fatura como `SKIPPED`.

### 5.7 Notificações — `modules/notifications`

| Action | Entrada | Saída |
|---|---|---|
| `markNotificationRead` | `{ id }` | `{ unread: number }` |
| `markAllNotificationsRead` | `{}` | `{ unread: 0 }` |
| `updateNotificationPreferences` | `NotificationPreferencesInput` | `NotificationPreferencesDTO` |

```ts
export const NotificationPreferencesInput = z.object({
  emailEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  invoiceDueDaysBefore: z.int().min(0).max(10),
  subscriptionDaysBefore: z.int().min(0).max(10).nullable(),   // null = desativado
  subscriptionMin: MoneyInput.optional(),
  trialReminders: z.boolean(),
  overdueAlerts: z.boolean(),
  dailyDigest: z.boolean(),
}).partial();
```

### 5.8 Conta — `modules/accounts`

| Action | Entrada | Saída | Requisitos |
|---|---|---|---|
| `updateProfile` | `{ name?: 1–80, timezone?: IANA, locale?: "pt-BR" }` | `ProfileDTO` | RF-004 |
| `completeOnboarding` | `{}` | `{ ok: true }` | RF-080 |
| `requestAccountDeletion` | `{ confirmEmail: string }` (deve igualar o e-mail da conta) | `{ purgeAfter: DateOnly }` → encerra sessões | RF-007 |
| `reactivateAccount` | `{}` (usuário em período de exclusão faz login) | `ProfileDTO` | RF-007 |

> Encerrar a sessão atual ou todas (RF-005) usa o cliente Better Auth (`authClient.signOut()`, `authClient.revokeSessions()`), não uma Server Action própria.

---

## 6. Query services (leitura, RSC)

Funções de servidor chamadas por Server Components; todas recebem `userId` como 1º argumento e retornam DTOs serializáveis.

| Função | Retorno | Usado em |
|---|---|---|
| `cards.listCards(userId, { includeArchived? })` | `CardWithCurrentInvoiceDTO[]` | `/cards`, dashboard |
| `cards.getCard(userId, cardId)` | `CardDetailDTO` (cartão + fatura atual + últimas 12 faturas) | `/cards/[id]` |
| `invoices.getInvoice(userId, cardId, referenceMonth)` | `InvoiceDetailDTO` (inclui previstas) | `/cards/[id]/invoices/[ref]` |
| `subscriptions.listSubscriptions(userId, { status?, cardId?, categoryId?, sort?, cursor?, limit? })` | `Page<SubscriptionDTO>` | `/subscriptions` |
| `subscriptions.getSubscription(userId, id)` | `SubscriptionDetailDTO` (+ histórico de preço, últimas cobranças) | `/subscriptions/[id]` |
| `expenses.listExpenses(userId, { cardId?, cursor?, limit? })` | `Page<ExpenseDTO>` | `/expenses` |
| `dashboard.getDashboard(userId, month)` | `DashboardDTO` | `/dashboard` |
| `dashboard.getProjection(userId, months = 12)` | `ProjectionDTO` | `/dashboard` |
| `dashboard.getCalendar(userId, from, to)` | `CalendarEventDTO[]` | `/calendar` |
| `notifications.list(userId, { cursor?, limit? })` | `Page<NotificationDTO>` | `/notifications` |
| `notifications.unreadCount(userId)` | `number` | sino (layout) |
| `categories.list(userId)` | `CategoryDTO[]` | formulários, filtros |

### 6.1 DTOs

```ts
interface MoneyDTO { amountCents: number; currency: "BRL" }

interface CardDTO {
  id: string; nickname: string; issuer: string | null;
  brand: CardBrand; last4: string | null; color: CardColor;
  limitCents: number | null; closingDay: number; dueDay: number;
  isDefault: boolean; archivedAt: string | null; updatedAt: string;
}
interface CardWithCurrentInvoiceDTO extends CardDTO {
  currentInvoice: InvoiceSummaryDTO;
  usedLimitCents: number | null;            // RN-14
  availableLimitCents: number | null;
}

interface InvoiceSummaryDTO {
  id: string | null;                        // null = fatura futura ainda não persistida
  cardId: string; referenceMonth: string;
  periodStart: string; closingDate: string; dueDate: string;
  totalCents: number;                       // materializado + previsto
  materializedCents: number;
  projectedCents: number;
  paidCents: number; balanceCents: number;
  status: InvoiceStatus | "FUTURE";
  datesOverridden: boolean;
}
interface InvoiceDetailDTO extends InvoiceSummaryDTO {
  charges: ChargeDTO[];
  payments: PaymentDTO[];
  prev: string | null; next: string;        // referenceMonth vizinhos (navegação ◀ ▶)
}
interface ChargeDTO {
  id: string | null;                        // null quando projected
  projected: boolean;                       // ○ previsto vs ● materializado
  sourceType: "SUBSCRIPTION" | "INSTALLMENT" | "ADJUSTMENT";
  sourceId: string | null;                  // subscriptionId | expenseId
  chargeDate: string; description: string;
  installment: { number: number; total: number } | null;
  amountCents: number;
  category: CategoryDTO | null;
}
interface PaymentDTO { id: string; amountCents: number; paidOn: string; note: string | null; createdAt: string }

interface SubscriptionDTO {
  id: string; name: string; amountCents: number; currency: "BRL";
  cycle: BillingCycle; nextChargeDate: string | null;   // null se PAUSED/CANCELED
  status: SubscriptionStatus; trialEndsOn: string | null; canceledOn: string | null;
  monthlyEquivalentCents: number; yearlyEquivalentCents: number;   // RN-12
  card: Pick<CardDTO, "id" | "nickname" | "color">;
  category: CategoryDTO | null; manageUrl: string | null; notes: string | null;
  updatedAt: string;
}

interface DashboardDTO {
  month: string;                                     // YYYY-MM
  committedThisMonthCents: number;                   // RF-050
  previousMonthCents: number;                        // comprometido do mês anterior (variação)
  recurringMonthlyCents: number;                     // RF-051
  projection: ProjectionDTO["months"];               // RF-055: 12 ciclos a partir do atual
  cards: (Pick<CardDTO, "id" | "nickname" | "issuer" | "brand" | "last4" | "color" | "closingDay" | "dueDay" | "limitCents">
    & { usedLimitCents: number | null;
        currentInvoice: { referenceMonth: string; dueDate: string; status: InvoiceStatus;
                          totalCents: number; projectedCents: number } })[];  // fatura atual (lançado + previsto)
  overdueInvoices: InvoiceSummaryDTO[];              // RF-056
  upcoming: CalendarEventDTO[];                      // RF-052 (14 dias)
  limitUsage: { cardId: string; nickname: string; usedCents: number; limitCents: number }[]; // RF-053
  byCategory: { category: CategoryDTO | null; totalCents: number }[];                      // RF-054
}
interface ProjectionDTO {                            // RF-055
  months: { referenceMonth: string; totalCents: number;
            byCard: { cardId: string; totalCents: number }[] }[];
}
interface CalendarEventDTO {
  date: string;
  type: "SUBSCRIPTION_CHARGE" | "INVOICE_CLOSING" | "INVOICE_DUE" | "TRIAL_ENDING" | "INSTALLMENT";
  title: string; amountCents: number | null;
  href: string;                                      // link interno
}
interface NotificationDTO {
  id: string; type: NotificationType; title: string; body: string | null;
  targetDate: string; createdAt: string; readAt: string | null; href: string | null;
}
interface Page<T> { items: T[]; nextCursor: string | null }
```

---

## 7. Exemplo de uso no cliente

```tsx
"use client";
export function PaymentDialog({ invoice }: { invoice: InvoiceSummaryDTO }) {
  const form = useForm({ resolver: zodResolver(RegisterPaymentForm),
                         defaultValues: { amount: formatCents(invoice.balanceCents), paidOn: today() } });
  const [pending, start] = useTransition();

  const onSubmit = form.handleSubmit((values) => start(async () => {
    const res = await registerPayment({ invoiceId: invoice.id!, ...values });
    if (res.ok) return toast.success("Pagamento registrado");
    if (res.error.code === "VALIDATION_ERROR") return applyFieldErrors(form, res.error.fieldErrors);
    toast.error(res.error.message);                   // PAYMENT_EXCEEDS_BALANCE, CONFLICT…
  }));
  /* … */
}
```

---

## 8. Route Handlers HTTP

Contrato completo em [`docs/api/openapi.yaml`](api/openapi.yaml). Resumo:

| Método | Rota | Autenticação | Descrição | Resposta de sucesso |
|---|---|---|---|---|
| `GET` | `/api/health` | — | Liveness + conectividade com o banco | `200 { status: "ok", db: "ok", version }` · `503` se banco indisponível |
| `GET` | `/api/cron/daily` | `Authorization: Bearer $CRON_SECRET` | Job diário (materializar, converter testes, fechar, vencer, reconciliar, limpar sessões) | `200 JobRunResult` · `409` se já em execução |
| `GET` | `/api/cron/reminders` | Bearer `CRON_SECRET` | Lembretes da janela 08:00–09:00 local (RN-20) | `200 JobRunResult` |
| `GET` | `/api/cron/purge` | Bearer `CRON_SECRET` | Purge LGPD e retenção | `200 JobRunResult` |
| `GET` | `/api/export` | Sessão (cookie) | Exportação LGPD (RF-006) | `200 application/json` com `Content-Disposition: attachment` |
| `POST` | `/api/unsubscribe?token=…` | Token HMAC assinado | Descadastro **one-click** (RFC 8058) | `200 { unsubscribed: NotificationType }` |
| `POST` | `/api/webhooks/resend` | Assinatura Svix (`svix-id`, `svix-timestamp`, `svix-signature`) | Eventos de e-mail (bounce, complaint, delivered) | `200 { received: true }` |

> **Por que `GET` nos crons?** O Vercel Cron invoca o caminho configurado com `GET` e envia automaticamente `Authorization: Bearer <CRON_SECRET>` quando a variável existe. Os handlers são idempotentes, então `GET` repetido é seguro.

### 8.1 `JobRunResult`
```json
{
  "jobRunId": "0b0f6a8e-6a3c-4f6e-8d7e-0a4a7f0e2c11",
  "job": "DAILY",
  "status": "SUCCEEDED",
  "startedAt": "2026-11-05T03:00:00.412Z",
  "finishedAt": "2026-11-05T03:00:07.981Z",
  "stats": {
    "usersProcessed": 1240,
    "chargesMaterialized": 3311,
    "trialsConverted": 12,
    "invoicesClosed": 402,
    "invoicesOverdue": 17,
    "reconciliationMismatches": 0,
    "errors": 0
  }
}
```

### 8.2 Token de descadastro
`token = base64url(payload) + "." + base64url(HMAC_SHA256(UNSUBSCRIBE_SECRET, payload))`, com `payload = { uid, type, iat }`. Sem expiração (exigência de one-click), revogável trocando o segredo. O e-mail inclui:
```
List-Unsubscribe: <https://finflow.app/api/unsubscribe?token=…>, <mailto:unsubscribe@finflow.app?subject=…>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```
A página `/unsubscribe?token=…` (UI) oferece confirmação visual e chama o mesmo endpoint.

### 8.3 Formato da exportação LGPD
```json
{
  "exportedAt": "2026-11-04T14:03:22.120Z",
  "schemaVersion": 1,
  "profile": { "email": "ana@exemplo.com", "name": "Ana", "timezone": "America/Sao_Paulo", "currency": "BRL", "createdAt": "…" },
  "consents": [ { "type": "TERMS", "version": "2026-10", "acceptedAt": "…" } ],
  "cards": [ ... ], "categories": [ ... ], "subscriptions": [ ... ], "subscriptionPriceHistory": [ ... ],
  "expenses": [ ... ], "invoices": [ ... ], "charges": [ ... ], "payments": [ ... ],
  "notificationPreferences": { ... }, "notifications": [ ... ]
}
```
Excluídos: `sessions`, tokens de `accounts`, `verifications`, `ip_hash`.

---

## 9. Autenticação (`/api/auth/*`, Better Auth)

Montado em `src/app/api/auth/[...all]/route.ts` com `toNextJsHandler(auth)`. Endpoints usados pelo app (via `authClient`):

| Ação | Cliente | Endpoint |
|---|---|---|
| Solicitar magic link | `authClient.signIn.magicLink({ email, callbackURL: "/dashboard", newUserCallbackURL: "/onboarding" })` | `POST /api/auth/sign-in/magic-link` |
| Verificar link (clique no e-mail) | — | `GET /api/auth/magic-link/verify?token=…&callbackURL=…` |
| Login Google | `authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })` | `POST /api/auth/sign-in/social` → redirect → `GET /api/auth/callback/google` |
| Sessão atual | `authClient.useSession()` / `auth.api.getSession({ headers })` no servidor | `GET /api/auth/get-session` |
| Sair | `authClient.signOut()` | `POST /api/auth/sign-out` |
| Sair de todas as sessões | `authClient.revokeSessions()` | `POST /api/auth/revoke-sessions` |

Configuração: magic link com `expiresIn: 900` (15 min, RF-001) e envio pelo `Mailer` (Resend); sessão `expiresIn: 30 dias`, `updateAge: 1 dia` (RF-008); rate limit próprio do Better Auth **desligado** em favor do Upstash (§4), para ter uma única política.

---

## 10. API REST v1 (planejada)

Quando houver app mobile ou integrações (v2), a REST v1 será um novo adapter de entrega sobre os **mesmos casos de uso** das Server Actions. Autenticação por *bearer token* (plugin `bearer`/`apiKey` do Better Auth), versionamento no caminho, mesmos códigos de erro (§3) e DTOs (§6.1).

| Server Action / Query | REST v1 |
|---|---|
| `listCards` / `createCard` | `GET` / `POST /api/v1/cards` |
| `getCard` / `updateCard` / `deleteCard` | `GET` / `PATCH` / `DELETE /api/v1/cards/{id}` |
| `archiveCard` / `unarchiveCard` | `POST /api/v1/cards/{id}/archive` · `/unarchive` |
| `getInvoice` | `GET /api/v1/cards/{id}/invoices/{referenceMonth}` |
| `registerPayment` | `POST /api/v1/invoices/{id}/payments` |
| `deletePayment` | `DELETE /api/v1/payments/{id}` |
| `createAdjustment` | `POST /api/v1/invoices/{id}/adjustments` |
| `listSubscriptions` / `createSubscription` | `GET` / `POST /api/v1/subscriptions` |
| `updateSubscription` | `PATCH /api/v1/subscriptions/{id}` (header `If-Unmodified-Since` ⇐ `expectedUpdatedAt`) |
| `pause` / `resume` / `cancel` | `POST /api/v1/subscriptions/{id}/pause` · `/resume` · `/cancel` |
| `changeSubscriptionPrice` | `POST /api/v1/subscriptions/{id}/prices` |
| `listExpenses` / `createExpense` | `GET` / `POST /api/v1/expenses` |
| `getDashboard` / `getProjection` | `GET /api/v1/dashboard?month=` · `GET /api/v1/projection?months=` |
| `notifications.list` / `markRead` | `GET /api/v1/notifications` · `POST /api/v1/notifications/{id}/read` |
| `clientRequestId` | header `Idempotency-Key` |

---

## 11. Versionamento e compatibilidade

| Superfície | Política |
|---|---|
| Server Actions / Query services | Sem versionamento (mesmo deploy que o cliente). Deploys "skew-protected" pela Vercel (Skew Protection) para que abas antigas continuem funcionando |
| Route Handlers internos (cron, webhook) | Mudanças coordenadas com `vercel.json` / painel do provedor |
| `/api/export` | `schemaVersion` no corpo; mudanças aditivas não incrementam |
| REST v1 | Semântica: apenas mudanças aditivas em `v1`; breaking ⇒ `v2` com 6 meses de convivência; header `Deprecation`/`Sunset` |
