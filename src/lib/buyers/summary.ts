import type { BuyerRecord } from "./types";
import { analyzeBuyer } from "./intelligence";
import { evaluateBuyerEvidence } from "./evidence";
import { verifyBuyer } from "./verification";

export function buildBuyerSummary(buyer: BuyerRecord) {
  const intelligence = analyzeBuyer(buyer);
  const evidence = evaluateBuyerEvidence(buyer);
  const verification = verifyBuyer(buyer);

  return {
    buyer,
    intelligence,
    evidence,
    verification,
    readiness:
      verification.status === "verified" &&
      evidence.status === "strong"
        ? "outreach-ready"
        : verification.status === "partially-verified"
          ? "needs-verification"
          : "research",
  };
}
