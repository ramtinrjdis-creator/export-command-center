import type { Entitlement } from "./entitlements";
import {
  hasCapability,
  type CommercialCapability,
  type CommercialPlan,
} from "./plan-policy";
import { verifyEntitlementToken } from "./entitlement-token";

export type AccessDecision =
  | {
      allowed: true;
      plan: CommercialPlan;
      capability: CommercialCapability;
      tokenJti: string | null;
      reason: "free-capability" | "verified-pro-entitlement";
    }
  | {
      allowed: false;
      capability: CommercialCapability;
      reason:
        | "missing_entitlement"
        | "invalid_entitlement"
        | "capability_not_granted";
      detail: string;
    };

function capabilityEntitlement(
  capability: CommercialCapability,
): Entitlement {
  switch (capability) {
    case "buyer_intelligence":
      return "buyer_intelligence";
    case "supplier_landscape":
      return "supplier_landscape";
    case "decision_pack":
      return "decision_pack";
    case "market_scan":
    case "deep_analysis":
    case "decision_workspace":
    case "saved_workspace":
      return "market_scan";
  }
}

export function decideCommercialAccess(input: {
  capability: CommercialCapability;
  token: string | null | undefined;
  secret: string | null | undefined;
  verifiedPlan?: CommercialPlan | null;
  nowMs?: number;
}): AccessDecision {
  const entitlement =
    capabilityEntitlement(
      input.capability,
    );

  const verification =
    verifyEntitlementToken(
      input.token,
      input.secret,
      entitlement,
      input.nowMs,
    );

  if (verification.valid) {
    if (
      !hasCapability(
        verification.payload.plan,
        input.capability,
      )
    ) {
      return {
        allowed: false,
        capability: input.capability,
        reason: "capability_not_granted",
        detail: "Verified plan does not grant this capability.",
      };
    }

    return {
      allowed: true,
      plan: verification.payload.plan,
      capability: input.capability,
      tokenJti: verification.payload.jti,
      reason: "verified-pro-entitlement",
    };
  }

  if (
    input.capability === "market_scan" ||
    input.capability === "supplier_landscape" ||
    input.capability === "decision_workspace"
  ) {
    return {
      allowed: true,
      plan: "free",
      capability: input.capability,
      tokenJti: null,
      reason: "free-capability",
    };
  }

  return {
    allowed: false,
    capability: input.capability,
    reason:
      verification.reason ===
      "missing_entitlement_token"
        ? "missing_entitlement"
        : "invalid_entitlement",
    detail: verification.reason,
  };
}
