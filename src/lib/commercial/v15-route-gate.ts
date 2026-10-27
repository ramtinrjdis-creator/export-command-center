import { evaluateV15Readiness } from "./v15-readiness";

export type PaidRouteGateResult =
  | {
      allowed: true;
      reason: "production_ready";
    }
  | {
      allowed: false;
      reason:
        | "production_commercial_core_not_ready"
        | "paid_provider_disabled";
      blockers: string[];
    };

/**
 * IMPORTANT:
 * This gate does not pretend that environment variables are authentication.
 * It only permits paid provider execution in production after ALL production
 * authority requirements have explicitly been wired.
 *
 * Until a real auth provider, persistent subscription store, durable usage
 * store, durable billing idempotency store, webhook secret and durable abuse
 * state exist, production paid provider access remains disabled.
 */
export function evaluatePaidBuyerRouteGate(input?: {
  paidProviderEnabled?: boolean;
}): PaidRouteGateResult {
  const paidProviderEnabled =
    input?.paidProviderEnabled ??
    process.env.ENABLE_PAID_BUYER_PROVIDER ===
      "true";

  if (!paidProviderEnabled) {
    return {
      allowed: false,
      reason: "paid_provider_disabled",
      blockers: [],
    };
  }

  const readiness =
    evaluateV15Readiness({
      environment:
        process.env.NODE_ENV ===
        "production"
          ? "production"
          : "test",

      persistentSubscriptionStore:
        process.env
          .ECC_V15_PERSISTENT_SUBSCRIPTION_STORE ===
        "true",

      persistentUsageStore:
        process.env
          .ECC_V15_PERSISTENT_USAGE_STORE ===
        "true",

      persistentIdempotencyStore:
        process.env
          .ECC_V15_PERSISTENT_IDEMPOTENCY_STORE ===
        "true",

      authenticatedIdentityProvider:
        process.env
          .ECC_V15_AUTH_PROVIDER_CONFIGURED ===
        "true",

      billingWebhookSecret:
        Boolean(
          process.env
            .BILLING_WEBHOOK_SECRET,
        ),

      abuseStore:
        process.env
          .ECC_V15_PERSISTENT_ABUSE_STORE ===
        "true",
    });

  if (!readiness.ready) {
    return {
      allowed: false,
      reason:
        "production_commercial_core_not_ready",
      blockers: readiness.blockers,
    };
  }

  return {
    allowed: true,
    reason: "production_ready",
  };
}
