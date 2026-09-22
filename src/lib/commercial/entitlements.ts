export type PlanId = "free" | "pro";

export type Entitlement =
  | "market_scan"
  | "evidence_layers"
  | "supplier_landscape"
  | "buyer_intelligence"
  | "decision_pack"
  | "market_access_evidence"
  | "advanced_research";

const FREE_ENTITLEMENTS = new Set<Entitlement>([
  "market_scan",
  "evidence_layers",
]);

const PRO_ENTITLEMENTS = new Set<Entitlement>([
  "market_scan",
  "evidence_layers",
  "supplier_landscape",
  "buyer_intelligence",
  "decision_pack",
  "market_access_evidence",
  "advanced_research",
]);

export function hasEntitlement(
  plan: PlanId,
  entitlement: Entitlement
) {
  const source =
    plan === "pro"
      ? PRO_ENTITLEMENTS
      : FREE_ENTITLEMENTS;

  return source.has(entitlement);
}

export function getEntitlements(plan: PlanId) {
  const source =
    plan === "pro"
      ? PRO_ENTITLEMENTS
      : FREE_ENTITLEMENTS;

  return Array.from(source);
}

export function normalizePlan(
  value: string | undefined | null
): PlanId {
  return value === "pro" ? "pro" : "free";
}
