-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAUSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'CLOSED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ChargeSource" AS ENUM ('SUBSCRIPTION', 'INSTALLMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INVOICE_DUE', 'INVOICE_OVERDUE', 'SUBSCRIPTION_CHARGE', 'TRIAL_ENDING', 'DAILY_DIGEST');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'MARKETING');

-- CreateEnum
CREATE TYPE "JobName" AS ENUM ('DAILY', 'REMINDERS', 'PURGE', 'BACKUP');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL DEFAULT '',
    "email" VARCHAR(254) NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" VARCHAR(500),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "onboarding_completed_at" TIMESTAMPTZ(3),
    "email_suppressed_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" VARCHAR(255) NOT NULL,
    "provider_id" VARCHAR(64) NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(3),
    "refresh_token_expires_at" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" UUID NOT NULL,
    "identifier" VARCHAR(254) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "ip_hash" CHAR(64),
    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nickname" VARCHAR(40) NOT NULL,
    "issuer" VARCHAR(60),
    "brand" "CardBrand" NOT NULL DEFAULT 'OTHER',
    "last4" CHAR(4),
    "color" VARCHAR(20) NOT NULL DEFAULT 'violet',
    "limit_cents" BIGINT,
    "closing_day" SMALLINT NOT NULL,
    "due_day" SMALLINT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(40) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "category_id" UUID,
    "name" VARCHAR(80) NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "billing_anchor_day" SMALLINT NOT NULL,
    "next_charge_date" DATE NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "trial_ends_on" DATE,
    "paused_at" TIMESTAMPTZ(3),
    "canceled_on" DATE,
    "manage_url" VARCHAR(500),
    "catalog_slug" VARCHAR(60),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_price_history" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "category_id" UUID,
    "description" VARCHAR(120) NOT NULL,
    "total_cents" BIGINT NOT NULL,
    "installments" SMALLINT NOT NULL DEFAULT 1,
    "purchase_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "reference_month" CHAR(7) NOT NULL,
    "period_start" DATE NOT NULL,
    "closing_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "total_cents" BIGINT NOT NULL DEFAULT '0',
    "paid_cents" BIGINT NOT NULL DEFAULT '0',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "dates_overridden" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "source_type" "ChargeSource" NOT NULL,
    "subscription_id" UUID,
    "expense_id" UUID,
    "installment_number" SMALLINT,
    "installment_total" SMALLINT,
    "charge_date" DATE NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "category_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "paid_on" DATE NOT NULL,
    "note" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "entity_id" UUID NOT NULL,
    "target_date" DATE NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "provider_message_id" VARCHAR(100),
    "sent_at" TIMESTAMPTZ(3),
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "invoice_due_enabled" BOOLEAN NOT NULL DEFAULT true,
    "invoice_due_days_before" SMALLINT NOT NULL DEFAULT 3,
    "subscription_days_before" SMALLINT DEFAULT 1,
    "subscription_min_cents" BIGINT NOT NULL DEFAULT '0',
    "trial_reminders" BOOLEAN NOT NULL DEFAULT true,
    "overdue_alerts" BOOLEAN NOT NULL DEFAULT true,
    "daily_digest" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "job" "JobName" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "stats" JSONB,
    "error" TEXT,
    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_id_account_id_key" ON "accounts"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE INDEX "consents_user_id_type_idx" ON "consents"("user_id", "type");

-- CreateIndex
CREATE INDEX "cards_user_id_archived_at_idx" ON "cards"("user_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_user_id_name_key" ON "categories"("user_id", "name");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_next_charge_date_idx" ON "subscriptions"("status", "next_charge_date");

-- CreateIndex
CREATE INDEX "subscriptions_status_trial_ends_on_idx" ON "subscriptions"("status", "trial_ends_on");

-- CreateIndex
CREATE INDEX "subscriptions_card_id_idx" ON "subscriptions"("card_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_price_history_subscription_id_effective_from_key" ON "subscription_price_history"("subscription_id", "effective_from");

-- CreateIndex
CREATE INDEX "expenses_user_id_purchase_date_idx" ON "expenses"("user_id", "purchase_date");

-- CreateIndex
CREATE INDEX "expenses_card_id_idx" ON "expenses"("card_id");

-- CreateIndex
CREATE INDEX "invoices_user_id_due_date_idx" ON "invoices"("user_id", "due_date");

-- CreateIndex
CREATE INDEX "invoices_status_closing_date_idx" ON "invoices"("status", "closing_date");

-- CreateIndex
CREATE INDEX "invoices_status_due_date_idx" ON "invoices"("status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_card_id_reference_month_key" ON "invoices"("card_id", "reference_month");

-- CreateIndex
CREATE INDEX "charges_invoice_id_idx" ON "charges"("invoice_id");

-- CreateIndex
CREATE INDEX "charges_user_id_charge_date_idx" ON "charges"("user_id", "charge_date");

-- CreateIndex
CREATE INDEX "charges_card_id_charge_date_idx" ON "charges"("card_id", "charge_date");

-- CreateIndex
CREATE UNIQUE INDEX "charges_subscription_id_charge_date_key" ON "charges"("subscription_id", "charge_date");

-- CreateIndex
CREATE UNIQUE INDEX "charges_expense_id_installment_number_key" ON "charges"("expense_id", "installment_number");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_user_id_paid_on_idx" ON "payments"("user_id", "paid_on");

-- CreateIndex
CREATE INDEX "notifications_user_id_channel_read_at_idx" ON "notifications"("user_id", "channel", "read_at");

-- CreateIndex
CREATE INDEX "notifications_status_attempts_idx" ON "notifications"("status", "attempts");

-- CreateIndex
CREATE INDEX "notifications_provider_message_id_idx" ON "notifications"("provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_type_entity_id_target_date_channel_key" ON "notifications"("user_id", "type", "entity_id", "target_date", "channel");

-- CreateIndex
CREATE INDEX "job_runs_job_started_at_idx" ON "job_runs"("job", "started_at");

-- CreateIndex
CREATE INDEX "webhook_events_provider_received_at_idx" ON "webhook_events"("provider", "received_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_price_history" ADD CONSTRAINT "subscription_price_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────────────────────────────────────────────────────────────────
-- Constraints e índices parciais (fonte: prisma/sql/constraints.sql)
-- ───────────────────────────────────────────────────────────────────────
-- FinFlow — constraints e índices não expressáveis no schema Prisma.
-- Anexar ao final da migração inicial (prisma migrate dev --create-only).
-- Documentação: docs/DATABASE.md §6

-- cards ------------------------------------------------------------------
ALTER TABLE cards
  ADD CONSTRAINT cards_closing_day_chk CHECK (closing_day BETWEEN 1 AND 31),
  ADD CONSTRAINT cards_due_day_chk     CHECK (due_day BETWEEN 1 AND 31),
  ADD CONSTRAINT cards_last4_chk       CHECK (last4 IS NULL OR last4 ~ '^[0-9]{4}$'),
  ADD CONSTRAINT cards_limit_chk       CHECK (limit_cents IS NULL OR limit_cents >= 0),
  ADD CONSTRAINT cards_nickname_chk    CHECK (length(btrim(nickname)) > 0);

-- No máximo um cartão padrão (não arquivado) por usuário.
CREATE UNIQUE INDEX cards_one_default_per_user
  ON cards (user_id) WHERE is_default AND archived_at IS NULL;

-- subscriptions ----------------------------------------------------------
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_amount_chk   CHECK (amount_cents > 0),
  ADD CONSTRAINT subscriptions_anchor_chk   CHECK (billing_anchor_day BETWEEN 1 AND 31),
  ADD CONSTRAINT subscriptions_trial_chk    CHECK (status <> 'TRIAL' OR trial_ends_on IS NOT NULL),
  ADD CONSTRAINT subscriptions_canceled_chk CHECK (status <> 'CANCELED' OR canceled_on IS NOT NULL),
  ADD CONSTRAINT subscriptions_currency_chk CHECK (currency ~ '^[A-Z]{3}$');

-- Projeção/materialização só olha assinaturas vivas.
CREATE INDEX subscriptions_live_next_charge
  ON subscriptions (next_charge_date) WHERE status IN ('ACTIVE', 'TRIAL');

-- subscription_price_history ---------------------------------------------
ALTER TABLE subscription_price_history
  ADD CONSTRAINT price_history_amount_chk CHECK (amount_cents > 0);

-- expenses ---------------------------------------------------------------
ALTER TABLE expenses
  ADD CONSTRAINT expenses_total_chk        CHECK (total_cents > 0),
  ADD CONSTRAINT expenses_installments_chk CHECK (installments BETWEEN 1 AND 48);

-- invoices ---------------------------------------------------------------
ALTER TABLE invoices
  ADD CONSTRAINT invoices_ref_month_chk CHECK (reference_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT invoices_dates_chk     CHECK (period_start < closing_date AND closing_date <= due_date),
  ADD CONSTRAINT invoices_paid_chk      CHECK (paid_cents >= 0);

-- Faturas que o job diário precisa olhar (fechar / vencer).
CREATE INDEX invoices_pending_close ON invoices (closing_date) WHERE status = 'OPEN';
CREATE INDEX invoices_pending_due   ON invoices (due_date)
  WHERE status IN ('CLOSED', 'PARTIALLY_PAID');

-- charges ----------------------------------------------------------------
ALTER TABLE charges
  ADD CONSTRAINT charges_source_chk CHECK (
       (source_type = 'SUBSCRIPTION' AND subscription_id IS NOT NULL AND expense_id IS NULL
          AND installment_number IS NULL AND amount_cents > 0)
    OR (source_type = 'INSTALLMENT' AND expense_id IS NOT NULL AND subscription_id IS NULL
          AND installment_number BETWEEN 1 AND installment_total AND amount_cents > 0)
    OR (source_type = 'ADJUSTMENT' AND subscription_id IS NULL AND expense_id IS NULL
          AND installment_number IS NULL AND amount_cents <> 0)
  );

-- payments ---------------------------------------------------------------
ALTER TABLE payments
  ADD CONSTRAINT payments_amount_chk CHECK (amount_cents > 0);

-- notification_preferences -----------------------------------------------
ALTER TABLE notification_preferences
  ADD CONSTRAINT prefs_invoice_days_chk CHECK (invoice_due_days_before BETWEEN 0 AND 10),
  ADD CONSTRAINT prefs_sub_days_chk     CHECK (subscription_days_before IS NULL
                                               OR subscription_days_before BETWEEN 0 AND 10),
  ADD CONSTRAINT prefs_min_cents_chk    CHECK (subscription_min_cents >= 0);

-- notifications: fila de reenvio ------------------------------------------
CREATE INDEX notifications_retry_queue
  ON notifications (created_at) WHERE status = 'FAILED' AND attempts < 4;

-- job_runs: no máximo uma execução RUNNING por job (trava contra concorrência,
-- segura com pool de conexões; execuções presas são liberadas pela aplicação) --
CREATE UNIQUE INDEX job_runs_one_running_per_job
  ON job_runs (job) WHERE status = 'RUNNING';
