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

  // Source quality
  if (buyer.evidenceStatus === "strong") {
    score += 25;
    reasons.push("Strong buyer evidence.");
  } else if (buyer.evidenceStatus === "moderate") {
    score += 15;
    reasons.push("Moderate buyer evidence.");
  } else {
    score += 5;
    reasons.push("Limited buyer evidence.");
  }

  // Product-specific shipment activity is the strongest behavioral signal.
  if (buyer.matchingShipments !== null) {
    if (buyer.matchingShipments >= 20) {
      score += 35;
      reasons.push("High product-matched shipment activity.");
    } else if (buyer.matchingShipments >= 5) {
      score += 25;
      reasons.push("Meaningful product-matched shipment activity.");
    } else if (buyer.matchingShipments > 0) {
      score += 12;
      reasons.push("Product-matched shipment activity recorded.");
    } else {
      reasons.push("No product-matched shipment activity recorded.");
    }
  } else {
    reasons.push("Product-matched shipment activity is unavailable.");
  }

  // Lifetime activity is supporting evidence, not product proof.
  if (buyer.shipmentCount !== null) {
    if (buyer.shipmentCount >= 50) {
      score += 10;
      reasons.push("High overall shipment activity.");
    } else if (buyer.shipmentCount >= 10) {
      score += 7;
      reasons.push("Meaningful overall shipment activity.");
    } else if (buyer.shipmentCount > 0) {
      score += 3;
      reasons.push("Some overall shipment activity recorded.");
    }
  }

  // Provider relevance
  if (buyer.relevanceScore !== null) {
    if (buyer.relevanceScore >= 70) {
      score += 15;
      reasons.push("Strong product relevance.");
    } else if (buyer.relevanceScore >= 40) {
      score += 8;
      reasons.push("Moderate product relevance.");
    }
  }

  // Provider specialization
  if (buyer.specialization !== null) {
    if (buyer.specialization >= 70) {
      score += 10;
      reasons.push("Strong product specialization.");
    } else if (buyer.specialization >= 40) {
      score += 5;
      reasons.push("Moderate product specialization.");
    }
  }

  // Supplier breadth is supporting context only.
  if (buyer.supplierCount !== null && buyer.supplierCount > 0) {
    score += 5;
    reasons.push("Supplier relationship evidence available.");
  }

  if (buyer.lastShipmentDate) {
    reasons.push("Shipment date evidence is available.");
  } else {
    reasons.push("Recent shipment evidence is unavailable.");
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
        ? "Validate product activity, company details, and recency before outreach."
        : signal === "low-signal"
          ? "Collect stronger product-specific shipment and company evidence."
          : "Connect a live buyer data source before prioritizing this buyer.";

  return {
    signal,
    signalScore: score,
    reasons,
    nextAction,
  };
}
