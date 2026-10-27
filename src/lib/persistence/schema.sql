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
