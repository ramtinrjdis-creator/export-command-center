import { productionCommercialPersistenceReady } from "./v15-production-config";

export type V15ReadinessInput = {
  environment: "development" | "test" | "production";
  persistentSubscriptionStore: boolean;
  persistentUsageStore: boolean;
  persistentIdempotencyStore: boolean;
  authenticatedIdentityProvider: boolean;
  billingWebhookSecret: boolean;
  abuseStore: boolean;
};

export type V15ReadinessResult = {
  ready: boolean;
  blockers: string[];
  capabilities: {
    trustedIdentity: boolean;
    subscriptionAuthority: boolean;
    persistentUsage: boolean;
    billingIdempotency: boolean;
    abuseControls: boolean;
  };
};

export function evaluateV15Readiness(
  input: V15ReadinessInput,
): V15ReadinessResult {
  const persistenceRuntimeReady =
    productionCommercialPersistenceReady();
  const blockers: string[] = [];

  if (
    input.environment === "production"
  ) {
    if (!persistenceRuntimeReady) {
      blockers.push(
        "production_persistence_runtime_not_ready",
      );
    }
    if (
      !input.authenticatedIdentityProvider
    ) {
      blockers.push(
        "authenticated_identity_provider_missing",
      );
    }

    if (
      !input.persistentSubscriptionStore
    ) {
      blockers.push(
        "persistent_subscription_store_missing",
      );
    }

    if (!input.persistentUsageStore) {
      blockers.push(
        "persistent_usage_store_missing",
      );
    }

    if (
      !input.persistentIdempotencyStore
    ) {
      blockers.push(
        "persistent_billing_idempotency_store_missing",
      );
    }

    if (!input.billingWebhookSecret) {
      blockers.push(
        "billing_webhook_secret_missing",
      );
    }

    if (!input.abuseStore) {
      blockers.push(
        "persistent_abuse_store_missing",
      );
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    capabilities: {
      trustedIdentity:
        input.authenticatedIdentityProvider,
      subscriptionAuthority:
        input.persistentSubscriptionStore,
      persistentUsage:
        input.persistentUsageStore,
      billingIdempotency:
        input.persistentIdempotencyStore,
      abuseControls:
        input.abuseStore,
    },
  };
}
