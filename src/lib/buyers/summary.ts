import type { BuyerRecord } from "./types";
import { analyzeBuyer } from "./intelligence";
import { evaluateBuyerEvidence } from "./evidence";
import { verifyBuyer } from "./verification";

export type BuyerReadiness =
  | "action-candidate"
  | "needs-verification"
  | "research";

export function buildBuyerSummary(buyer: BuyerRecord) {
  const intelligence = analyzeBuyer(buyer);
  const evidence = evaluateBuyerEvidence(buyer);
  const verification = verifyBuyer(buyer);

  const actionCandidate =
    intelligence.signal === "high-signal" &&
    evidence.status === "strong" &&
    verification.status === "verified";

  const needsVerification =
    !actionCandidate &&
    (intelligence.signal === "high-signal" ||
      intelligence.signal === "medium-signal") &&
    (evidence.status === "strong" ||
      evidence.status === "moderate") &&
    verification.status !== "verified";

  const readiness: BuyerReadiness = actionCandidate
    ? "action-candidate"
    : needsVerification
      ? "needs-verification"
      : "research";

  return {
    buyer,
    intelligence,
    evidence,
    verification,
    readiness,
  };
}
