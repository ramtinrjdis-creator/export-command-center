import {
  isPostgresConfigured,
} from "../persistence/postgres";

export type ProductionCommercialConfig = {
  environment:
    | "development"
    | "test"
    | "production";
  postgresConfigured: boolean;
  authenticatedIdentityProvider: boolean;
  billingWebhookConfigured: boolean;
  persistentAbuseStoreConfigured: boolean;
};

export function getProductionCommercialConfig(): ProductionCommercialConfig {
  const environment =
    process.env.NODE_ENV === "production"
      ? "production"
      : process.env.NODE_ENV === "test"
        ? "test"
        : "development";

  return {
    environment,
    postgresConfigured:
      isPostgresConfigured(),

    authenticatedIdentityProvider:
      process.env
        .ECC_V15_AUTH_PROVIDER_CONFIGURED ===
      "true",

    billingWebhookConfigured:
      Boolean(
        process.env.BILLING_WEBHOOK_SECRET?.trim(),
      ),

    persistentAbuseStoreConfigured:
      process.env
        .ECC_V15_PERSISTENT_ABUSE_STORE ===
      "true",
  };
}

export function productionCommercialPersistenceReady(): boolean {
  const config =
    getProductionCommercialConfig();

  return (
    config.environment !== "production" ||
    (
      config.postgresConfigured &&
      config.authenticatedIdentityProvider &&
      config.billingWebhookConfigured &&
      config.persistentAbuseStoreConfigured
    )
  );
}
