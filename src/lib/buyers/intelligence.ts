import type { BuyerRecord } from "./types";
import { evaluateBuyerEvidence } from "./evidence";

export type BuyerSignal =
  | "high-signal"
  | "medium-signal"
  | "low-signal"
  | "insufficient-evidence";

export type BuyerIntelligence = {
  signal: BuyerSignal;
  signalScore: number;
  reasons: string[];
  nextAction: string;
};

export function analyzeBuyer(buyer: BuyerRecord): BuyerIntelligence {
  const evidence = evaluateBuyerEvidence(buyer);

  const signal: BuyerSignal =
    evidence.score >= 75
      ? "high-signal"
      : evidence.score >= 50
        ? "medium-signal"
        : evidence.score > 0
          ? "low-signal"
          : "insufficient-evidence";

  const reasons = [
    ...evidence.signals,
    ...evidence.limitations,
  ];

  const nextAction =
    signal === "high-signal"
      ? "Verify the company and identify the appropriate decision-maker before outreach."
      : signal === "medium-signal"
        ? "Validate product activity, company details, and recency before outreach."
        : signal === "low-signal"
          ? "Collect stronger product-specific shipment and company evidence."
          : "Connect a live buyer data source before prioritizing this buyer.";

  return {
    signal,
    signalScore: evidence.score,
    reasons,
    nextAction,
  };
}
