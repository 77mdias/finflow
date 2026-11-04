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
