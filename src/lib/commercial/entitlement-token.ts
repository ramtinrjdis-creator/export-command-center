import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import type { Entitlement } from "./entitlements";
import {
  validateSubscription,
  type SubscriptionRecord,
} from "./subscription-contract";

export type EntitlementTokenPayload = {
  v: 2;
  sub: string;
  sid: string;
  customerId: string;
  provider: string;
  plan: "pro_monthly" | "pro_yearly";
  status: "active" | "trialing";
  periodStart: string;
  periodEnd: string;
  entitlements: Entitlement[];
  iat: number;
  exp: number;
  aud: "export-command-center";
  iss: "export-command-center";
  jti: string;
};

export type EntitlementVerification =
  | {
      valid: true;
      payload: EntitlementTokenPayload;
      subscription: SubscriptionRecord;
    }
  | {
      valid: false;
      reason:
        | "missing_entitlement_token"
        | "entitlement_secret_not_configured"
        | "invalid_token_format"
        | "invalid_token_signature"
        | "invalid_token_payload"
        | "invalid_token_claims"
        | "entitlement_not_granted"
        | "inactive_plan"
        | "subscription_not_active"
        | "invalid_billing_period"
        | "billing_period_does_not_match_plan"
        | "period_not_started"
        | "period_expired"
        | "invalid_token_issue_time"
        | "missing_user_id"
        | "missing_subscription_id"
        | "missing_customer_id"
        | "missing_provider"
        | "token_expired"
        | "token_lifetime_too_long"
        | "invalid_audience"
        | "invalid_issuer";
    };

const MAX_TOKEN_LIFETIME_SECONDS = 15 * 60;
const CLOCK_SKEW_SECONDS = 120;

function b64url(value: string | Uint8Array) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function unb64url(value: string) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(body: string, secret: string) {
  return b64url(
    createHmac("sha256", secret)
      .update(body)
      .digest(),
  );
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);

  return (
    aa.length === bb.length &&
    timingSafeEqual(aa, bb)
  );
}

export function verifyEntitlementToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  requiredEntitlement: Entitlement,
  nowMs = Date.now(),
): EntitlementVerification {
  if (!token) {
    return {
      valid: false,
      reason: "missing_entitlement_token",
    };
  }

  if (!secret || secret.length < 32) {
    return {
      valid: false,
      reason: "entitlement_secret_not_configured",
    };
  }

  const pieces = token.split(".");

  if (pieces.length !== 2) {
    return {
      valid: false,
      reason: "invalid_token_format",
    };
  }

  const [body, signature] = pieces;

  if (!safeEqual(sign(body, secret), signature)) {
    return {
      valid: false,
      reason: "invalid_token_signature",
    };
  }

  let payload: EntitlementTokenPayload;

  try {
    payload = JSON.parse(
      unb64url(body),
    ) as EntitlementTokenPayload;
  } catch {
    return {
      valid: false,
      reason: "invalid_token_payload",
    };
  }

  if (
    payload.v !== 2 ||
    !payload.sub ||
    !payload.sid ||
    !payload.customerId ||
    !payload.provider ||
    !payload.jti ||
    !payload.iat ||
    !payload.exp
  ) {
    return {
      valid: false,
      reason: "invalid_token_claims",
    };
  }

  if (
    payload.aud !== "export-command-center"
  ) {
    return {
      valid: false,
      reason: "invalid_audience",
    };
  }

  if (
    payload.iss !== "export-command-center"
  ) {
    return {
      valid: false,
      reason: "invalid_issuer",
    };
  }

  if (
    !payload.entitlements.includes(
      requiredEntitlement,
    )
  ) {
    return {
      valid: false,
      reason: "entitlement_not_granted",
    };
  }

  const nowSeconds = Math.floor(
    nowMs / 1000,
  );

  if (
    payload.exp <= nowSeconds
  ) {
    return {
      valid: false,
      reason: "token_expired",
    };
  }

  if (
    payload.exp - payload.iat >
    MAX_TOKEN_LIFETIME_SECONDS
  ) {
    return {
      valid: false,
      reason: "token_lifetime_too_long",
    };
  }

  if (
    payload.iat >
    nowSeconds + CLOCK_SKEW_SECONDS
  ) {
    return {
      valid: false,
      reason: "invalid_token_issue_time",
    };
  }

  const subscription: SubscriptionRecord = {
    userId: payload.sub,
    subscriptionId: payload.sid,
    customerId: payload.customerId,
    provider: payload.provider,
    plan: payload.plan,
    status: payload.status,
    currentPeriodStart: payload.periodStart,
    currentPeriodEnd: payload.periodEnd,
    entitlementVersion: payload.v,
  };

  const subscriptionValidation =
    validateSubscription(
      subscription,
      nowMs,
    );

  if (!subscriptionValidation.valid) {
    return {
      valid: false,
      reason:
        subscriptionValidation.reason as Extract<
          EntitlementVerification,
          { valid: false }
        >["reason"],
    };
  }

  return {
    valid: true,
    payload,
    subscription,
  };
}

export function assertTokenReplaySafe(
  seenJtis: ReadonlySet<string>,
  jti: string,
) {
  return !seenJtis.has(jti);
}
