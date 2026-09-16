import type { BuyerRecord } from "./types";
import { analyzeBuyer } from "./intelligence";
import { evaluateBuyerEvidence } from "./evidence";
import { verifyBuyer } from "./verification";

export type BuyerReadiness =
  | "outreach-ready"
  | "needs-verification"
  | "research";

export function buildBuyerSummary(buyer: BuyerRecord) {
  const intelligence = analyzeBuyer(buyer);
  const evidence = evaluateBuyerEvidence(buyer);
  const verification = verifyBuyer(buyer);

  const outreachReady =
    intelligence.signal === "high-signal" &&
    evidence.status === "strong" &&
    verification.status === "verified";

  const needsVerification =
    !outreachReady &&
    (intelligence.signal === "high-signal" ||
      intelligence.signal === "medium-signal") &&
    (evidence.status === "strong" ||
      evidence.status === "moderate") &&
    verification.status !== "verified";

  const readiness: BuyerReadiness = outreachReady
    ? "outreach-ready"
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
