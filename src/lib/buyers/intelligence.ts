import type { BuyerRecord } from "./types";

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
  let score = 0;
  const reasons: string[] = [];

  if (buyer.evidenceStatus === "strong") {
    score += 40;
    reasons.push("Strong buyer evidence.");
  } else if (buyer.evidenceStatus === "moderate") {
    score += 25;
    reasons.push("Moderate buyer evidence.");
  } else {
    score += 10;
    reasons.push("Limited buyer evidence.");
  }

  if (buyer.shipmentCount !== null) {
    if (buyer.shipmentCount >= 20) {
      score += 30;
      reasons.push("High shipment activity.");
    } else if (buyer.shipmentCount >= 5) {
      score += 20;
      reasons.push("Meaningful shipment activity.");
    } else if (buyer.shipmentCount > 0) {
      score += 10;
      reasons.push("Some shipment activity recorded.");
    }
  } else {
    reasons.push("Shipment activity is unavailable.");
  }

  if (buyer.lastShipmentDate) {
    score += 20;
    reasons.push("Recent shipment evidence is available.");
  } else {
    reasons.push("Recent shipment evidence is unavailable.");
  }

  if (buyer.productMatch) {
    score += 10;
    reasons.push("Product match information is available.");
  }

  score = Math.min(100, Math.round(score));

  const signal: BuyerSignal =
    score >= 75
      ? "high-signal"
      : score >= 50
        ? "medium-signal"
        : score > 0
          ? "low-signal"
          : "insufficient-evidence";

  const nextAction =
    signal === "high-signal"
      ? "Verify the company and identify the appropriate decision-maker before outreach."
      : signal === "medium-signal"
        ? "Validate recent activity and company details before outreach."
        : signal === "low-signal"
          ? "Collect stronger shipment and company evidence."
          : "Connect a live buyer data source before prioritizing this buyer.";

  return {
    signal,
    signalScore: score,
    reasons,
    nextAction,
  };
}
