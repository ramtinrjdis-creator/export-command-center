CREATE TABLE IF NOT EXISTS ecc_accounts (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ecc_users (
  id TEXT PRIMARY KEY,
  external_subject TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ecc_account_members (
  account_id TEXT NOT NULL REFERENCES ecc_accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES ecc_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, user_id)
);

CREATE TABLE IF NOT EXISTS ecc_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES ecc_accounts(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  entitlement_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_period_start BIGINT NOT NULL,
  current_period_end BIGINT NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecc_subscriptions_account
  ON ecc_subscriptions(account_id);

CREATE INDEX IF NOT EXISTS idx_ecc_subscriptions_customer
  ON ecc_subscriptions(customer_id);

CREATE TABLE IF NOT EXISTS ecc_billing_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  occurred_at BIGINT NOT NULL,
  customer_id TEXT,
  subscription_id TEXT,
  payload_hash TEXT NOT NULL,
  payload JSONB,
  processed_at BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecc_billing_events_subscription
  ON ecc_billing_events(subscription_id);

CREATE TABLE IF NOT EXISTS ecc_usage_counters (
  account_id TEXT NOT NULL REFERENCES ecc_accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES ecc_users(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  period_key TEXT NOT NULL,
  committed BIGINT NOT NULL DEFAULT 0,
  reserved BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (
    account_id,
    user_id,
    capability,
    period_key
  )
);

CREATE TABLE IF NOT EXISTS ecc_usage_reservations (
  reservation_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ecc_accounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES ecc_users(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  period_key TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (
    status IN ('reserved', 'committed', 'released', 'expired')
  ),
  reserved_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecc_usage_reservations_scope
  ON ecc_usage_reservations(
    account_id,
    user_id,
    capability,
    period_key
  );

CREATE TABLE IF NOT EXISTS ecc_abuse_counters (
  scope_key TEXT PRIMARY KEY,
  window_started_at BIGINT NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ecc_request_audit (
  request_id TEXT PRIMARY KEY,
  account_id TEXT,
  user_id TEXT,
  route TEXT NOT NULL,
  capability TEXT,
  status_code INTEGER,
  provider TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecc_request_audit_account
  ON ecc_request_audit(account_id);

CREATE INDEX IF NOT EXISTS idx_ecc_request_audit_created
  ON ecc_request_audit(created_at);

-- V16.4: Explicit authentication-provider identity mapping.
-- Legacy external_subject values are deliberately NOT migrated automatically.
-- Mapping must be established by a verified provider authentication flow.
CREATE TABLE IF NOT EXISTS ecc_auth_identities (
  provider TEXT NOT NULL,
  external_subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES ecc_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, external_subject),
  CHECK (length(provider) BETWEEN 1 AND 160),
  CHECK (length(external_subject) BETWEEN 1 AND 255)
);

CREATE INDEX IF NOT EXISTS idx_ecc_auth_identities_user
  ON ecc_auth_identities(user_id);

-- V16.8E: A durable record must exist before paid provider dispatch.
-- An uncertain result must never be automatically retried.
CREATE TABLE IF NOT EXISTS ecc_provider_executions (
  execution_id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL UNIQUE
    REFERENCES ecc_usage_reservations(reservation_id),
  account_id TEXT NOT NULL REFERENCES ecc_accounts(id),
  user_id TEXT NOT NULL REFERENCES ecc_users(id),
  provider TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'succeeded',
      'failed',
      'reconciliation_required'
    )),
  provider_request_id TEXT,
  result_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(request_hash) = 64),
  CHECK (length(provider) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ecc_provider_executions_status
  ON ecc_provider_executions(status, created_at);

-- V16.8H-B: evidence audit only; this table grants no settlement authority.
-- Store evidence digests, not raw credentials or sensitive provider payloads.
CREATE TABLE IF NOT EXISTS ecc_provider_reconciliation_events (
  event_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL
    REFERENCES ecc_provider_executions(execution_id),
  account_id TEXT NOT NULL REFERENCES ecc_accounts(id),
  actor_id TEXT NOT NULL,
  evidence_hash TEXT NOT NULL CHECK (
    evidence_hash ~ '^[a-f0-9]{64}$'
  ),
  event_type TEXT NOT NULL CHECK (
    event_type IN ('evidence_received', 'review_note')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecc_reconciliation_execution
  ON ecc_provider_reconciliation_events(execution_id, created_at);

-- Defense in depth against accidental modification through ordinary SQL.
-- Database owners / migration administrators retain privileged control.
CREATE OR REPLACE FUNCTION ecc_prevent_reconciliation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $ecc$
BEGIN
  RAISE EXCEPTION 'reconciliation_audit_immutable';
END;
$ecc$;

DO $ecc$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'ecc_reconciliation_append_only'
      AND tgrelid =
        'ecc_provider_reconciliation_events'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER ecc_reconciliation_append_only
    BEFORE UPDATE OR DELETE
    ON ecc_provider_reconciliation_events
    FOR EACH ROW
    EXECUTE FUNCTION ecc_prevent_reconciliation_mutation();
  END IF;
END;
$ecc$;
