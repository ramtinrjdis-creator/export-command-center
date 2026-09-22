import type { BuyerRecord } from "./types";
import { buildBuyerSummary } from "./summary";

export function summarizeBuyerValidation(
  buyers: BuyerRecord[]
) {
  const summaries = buyers.map(buildBuyerSummary);

  return {
    candidates: summaries.length,
    usableBuyers: summaries.filter(
      (item) =>
        item.evidence.status !== "unavailable"
    ).length,
    verifiedBuyers: summaries.filter(
      (item) =>
        item.verification.status === "verified"
    ).length,
    actionCandidateBuyers: summaries.filter(
      (item) =>
        item.readiness === "action-candidate"
    ).length,
  };
}
