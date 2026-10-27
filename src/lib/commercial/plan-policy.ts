export type CommercialPlan =
  | "free"
  | "pro_monthly"
  | "pro_yearly";

export type CommercialCapability =
  | "market_scan"
  | "deep_analysis"
  | "buyer_intelligence"
  | "supplier_landscape"
  | "decision_workspace"
  | "decision_pack"
  | "saved_workspace";

export type UsageMetric =
  | "market_scans"
  | "deep_analyses"
  | "buyer_provider_queries"
  | "supplier_queries"
  | "decision_packs";

export type PlanPolicy = {
  plan: CommercialPlan;
  capabilities: readonly CommercialCapability[];
  monthlyEquivalent: {
    [metric in UsageMetric]: number;
  };
};

export const PLAN_POLICIES: Record<CommercialPlan, PlanPolicy> = {
  free: {
    plan: "free",
    capabilities: [
      "market_scan",
      "supplier_landscape",
      "decision_workspace",
    ],
    monthlyEquivalent: {
      market_scans: 10,
      deep_analyses: 0,
      buyer_provider_queries: 0,
      supplier_queries: 10,
      decision_packs: 0,
    },
  },

  pro_monthly: {
    plan: "pro_monthly",
    capabilities: [
      "market_scan",
      "deep_analysis",
      "buyer_intelligence",
      "supplier_landscape",
      "decision_workspace",
      "decision_pack",
      "saved_workspace",
    ],
    monthlyEquivalent: {
      market_scans: 100,
      deep_analyses: 30,
      buyer_provider_queries: 30,
      supplier_queries: 100,
      decision_packs: 10,
    },
  },

  pro_yearly: {
    plan: "pro_yearly",
    capabilities: [
      "market_scan",
      "deep_analysis",
      "buyer_intelligence",
      "supplier_landscape",
      "decision_workspace",
      "decision_pack",
      "saved_workspace",
    ],
    monthlyEquivalent: {
      market_scans: 120,
      deep_analyses: 45,
      buyer_provider_queries: 45,
      supplier_queries: 150,
      decision_packs: 15,
    },
  },
};

export function hasCapability(
  plan: CommercialPlan,
  capability: CommercialCapability,
) {
  return PLAN_POLICIES[plan].capabilities.includes(capability);
}

export function getMonthlyEquivalentLimit(
  plan: CommercialPlan,
  metric: UsageMetric,
) {
  return PLAN_POLICIES[plan].monthlyEquivalent[metric];
}
