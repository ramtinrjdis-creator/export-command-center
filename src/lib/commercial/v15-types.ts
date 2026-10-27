export type V15Environment = "development" | "test" | "production";

export type TrustedIdentity = {
  userId: string;
  accountId: string;
  authenticated: true;
  issuedAt: number;
  source: string;
};

export type RequestIdentityMetadata = {
  ip: string | null;
  userAgent: string | null;
  deviceFingerprint: string | null;
};

export type SubscriptionState =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired"
  | "incomplete"
  | "unpaid";

export type SubscriptionSnapshot = {
  subscriptionId: string;
  customerId: string;
  accountId: string;
  state: SubscriptionState;
  planId: string;
  entitlementIds: string[];
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  updatedAt: number;
  source: string;
};

export type ServerAccessDecision =
  | {
      allowed: true;
      userId: string;
      accountId: string;
      entitlement: string;
      subscriptionId: string;
      planId: string;
      expiresAt: number;
      evaluatedAt: number;
    }
  | {
      allowed: false;
      code:
        | "identity_required"
        | "subscription_required"
        | "subscription_inactive"
        | "subscription_expired"
        | "entitlement_missing"
        | "account_mismatch"
        | "invalid_subscription_period"
        | "production_storage_unavailable"
        | "abuse_blocked";
      message: string;
    };

export type UsageScope = {
  accountId: string;
  userId: string;
  capability: string;
  periodKey: string;
};

export type UsageReservation = {
  reservationId: string;
  amount: number;
  reservedAt: number;
  expiresAt: number;
};

export type UsageRecord = {
  committed: number;
  reserved: number;
  updatedAt: number;
};

export type BillingEvent = {
  eventId: string;
  eventType: string;
  occurredAt: number;
  customerId: string | null;
  subscriptionId: string | null;
  payloadHash: string;
};

export type IdempotencyResult =
  | {
      status: "new";
      eventId: string;
    }
  | {
      status: "duplicate";
      eventId: string;
      firstProcessedAt: number;
    };

export type AbuseDecision =
  | {
      allowed: true;
      key: string;
      remaining: number;
      resetAt: number;
    }
  | {
      allowed: false;
      key: string;
      reason:
        | "account_rate_limit"
        | "ip_rate_limit"
        | "device_rate_limit"
        | "concurrent_limit";
      resetAt: number;
    };
