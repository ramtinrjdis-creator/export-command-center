export type ProviderCostClass =
  | "free"
  | "low"
  | "medium"
  | "high";

export type ProviderCostEstimate = {
  provider: string;
  operation: string;
  costClass: ProviderCostClass;
  credits: number | null;
  currencyUsd: number | null;
};

export type ProviderBudgetDecision =
  | {
      allowed: true;
      reason: "within_budget" | "free";
    }
  | {
      allowed: false;
      reason:
        | "provider_disabled"
        | "budget_unknown"
        | "budget_exceeded";
    };

export function evaluateProviderBudget(input: {
  providerEnabled: boolean;
  monthlyBudgetUsd: number | null;
  spentUsd: number | null;
  estimate: ProviderCostEstimate;
}): ProviderBudgetDecision {
  if (!input.providerEnabled) {
    return {
      allowed: false,
      reason: "provider_disabled",
    };
  }

  if (input.estimate.currencyUsd === 0) {
    return {
      allowed: true,
      reason: "free",
    };
  }

  if (
    input.monthlyBudgetUsd === null ||
    input.spentUsd === null ||
    input.estimate.currencyUsd === null
  ) {
    return {
      allowed: false,
      reason: "budget_unknown",
    };
  }

  if (input.monthlyBudgetUsd < 0 || input.spentUsd < 0) {
    return {
      allowed: false,
      reason: "budget_exceeded",
    };
  }

  return input.spentUsd + input.estimate.currencyUsd <=
    input.monthlyBudgetUsd
    ? {
        allowed: true,
        reason: "within_budget",
      }
    : {
        allowed: false,
        reason: "budget_exceeded",
      };
}

export function normalizeProviderCostClass(
  value: string | null | undefined,
): ProviderCostClass {
  const normalized = String(value ?? "").toLowerCase();

  if (
    normalized === "free" ||
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high"
  ) {
    return normalized;
  }

  return "high";
}
