import type { BuyerRecord } from "./types";

export type BuyerEvidenceStatus =
  | "strong"
  | "moderate"
  | "limited"
  | "unavailable";

export type BuyerEvidence = {
  status: BuyerEvidenceStatus;
  score: number;
  signals: string[];
  limitations: string[];
};

export function evaluateBuyerEvidence(
  buyer: BuyerRecord
): BuyerEvidence {
  let score = 0;
  const signals: string[] = [];
  const limitations: string[] = [];

  if (buyer.evidenceStatus === "strong") {
    score += 40;
    signals.push("Strong source evidence is available.");
  } else if (buyer.evidenceStatus === "moderate") {
    score += 25;
    signals.push("Moderate source evidence is available.");
  } else {
    score += 10;
    signals.push("Only limited source evidence is available.");
  }

  if (buyer.shipmentCount !== null) {
    if (buyer.shipmentCount >= 20) {
      score += 25;
      signals.push("High shipment activity is recorded.");
    } else if (buyer.shipmentCount >= 5) {
      score += 15;
      signals.push("Meaningful shipment activity is recorded.");
    } else if (buyer.shipmentCount > 0) {
      score += 8;
      signals.push("Some shipment activity is recorded.");
    }
  } else {
    limitations.push("Shipment activity is unavailable.");
  }

  if (buyer.lastShipmentDate) {
    score += 20;
    signals.push("Shipment date evidence is available.");
  } else {
    limitations.push("Recent shipment evidence is unavailable.");
  }

  if (buyer.productMatch) {
    score += 15;
    signals.push("Product match evidence is available.");
  } else {
    limitations.push("Product match evidence is unavailable.");
  }

  score = Math.min(100, score);

  const status: BuyerEvidenceStatus =
    score >= 75
      ? "strong"
      : score >= 50
        ? "moderate"
        : score > 0
          ? "limited"
          : "unavailable";

  return {
    status,
    score,
    signals,
    limitations,
  };
}
