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

  // Source quality
  if (buyer.evidenceStatus === "strong") {
    score += 30;
    signals.push("Strong source evidence is available.");
  } else if (buyer.evidenceStatus === "moderate") {
    score += 20;
    signals.push("Moderate source evidence is available.");
  } else {
    score += 8;
    signals.push("Only limited source evidence is available.");
  }

  // Product-specific shipment evidence is stronger than lifetime shipments.
  if (buyer.matchingShipments !== null) {
    if (buyer.matchingShipments >= 20) {
      score += 30;
      signals.push("High product-matched shipment activity is recorded.");
    } else if (buyer.matchingShipments >= 5) {
      score += 22;
      signals.push("Meaningful product-matched shipment activity is recorded.");
    } else if (buyer.matchingShipments > 0) {
      score += 12;
      signals.push("Product-matched shipment activity is recorded.");
    } else {
      limitations.push("No product-matched shipment activity is recorded.");
    }
  } else {
    limitations.push("Product-matched shipment activity is unavailable.");
  }

  // Lifetime shipment activity is supporting evidence only.
  if (buyer.shipmentCount !== null) {
    if (buyer.shipmentCount >= 50) {
      score += 10;
      signals.push("High overall shipment activity is recorded.");
    } else if (buyer.shipmentCount >= 10) {
      score += 7;
      signals.push("Meaningful overall shipment activity is recorded.");
    } else if (buyer.shipmentCount > 0) {
      score += 3;
      signals.push("Some overall shipment activity is recorded.");
    }
  } else {
    limitations.push("Overall shipment activity is unavailable.");
  }

  // ImportYeti relevance signal.
  if (buyer.relevanceScore !== null) {
    if (buyer.relevanceScore >= 70) {
      score += 15;
      signals.push("Strong product relevance is recorded.");
    } else if (buyer.relevanceScore >= 40) {
      score += 8;
      signals.push("Moderate product relevance is recorded.");
    } else {
      limitations.push("Product relevance is weak.");
    }
  } else {
    limitations.push("Product relevance score is unavailable.");
  }

  // ImportYeti specialization signal.
  if (buyer.specialization !== null) {
    if (buyer.specialization >= 70) {
      score += 10;
      signals.push("Strong product specialization is recorded.");
    } else if (buyer.specialization >= 40) {
      score += 5;
      signals.push("Moderate product specialization is recorded.");
    }
  } else {
    limitations.push("Product specialization is unavailable.");
  }

  // Supplier breadth is supporting context, not direct buyer proof.
  if (buyer.supplierCount !== null && buyer.supplierCount > 0) {
    score += 5;
    signals.push("Supplier relationship evidence is available.");
  } else {
    limitations.push("Supplier relationship evidence is unavailable.");
  }

  // A product match string alone is weak evidence.
  if (buyer.productMatch) {
    signals.push("Product match information is available.");
  } else {
    limitations.push("Product match information is unavailable.");
  }

  if (buyer.lastShipmentDate) {
    signals.push("Shipment date evidence is available.");
  } else {
    limitations.push("Recent shipment evidence is unavailable.");
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
