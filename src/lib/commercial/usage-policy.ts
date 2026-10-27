import {
  getMonthlyEquivalentLimit,
  type CommercialPlan,
  type UsageMetric,
} from "./plan-policy";

export type UsageSnapshot = {
  metric: UsageMetric;
  used: number;
  reserved: number;
};

export type UsageDecision =
  | {
      allowed: true;
      remaining: number;
      limit: number;
    }
  | {
      allowed: false;
      remaining: 0;
      limit: number;
      reason:
        | "limit_reached"
        | "negative_usage"
        | "negative_reservation";
    };

export function evaluateUsage(
  plan: CommercialPlan,
  metric: UsageMetric,
  snapshot: UsageSnapshot,
): UsageDecision {
  const limit = getMonthlyEquivalentLimit(plan, metric);

  if (snapshot.used < 0) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      reason: "negative_usage",
    };
  }

  if (snapshot.reserved < 0) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      reason: "negative_reservation",
    };
  }

  const remaining = Math.max(
    0,
    limit - snapshot.used - snapshot.reserved,
  );

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      reason: "limit_reached",
    };
  }

  return {
    allowed: true,
    remaining,
    limit,
  };
}
