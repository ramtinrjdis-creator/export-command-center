import type { BuyerRecord } from "./types";

export type BuyerVerificationStatus =
  | "verified"
  | "partially-verified"
  | "unverified";

export type BuyerVerification = {
  status: BuyerVerificationStatus;
  score: number;
  verifiedSignals: string[];
  missingSignals: string[];
};

export function verifyBuyer(
  buyer: BuyerRecord
): BuyerVerification {
  let score = 0;
  const verifiedSignals: string[] = [];
  const missingSignals: string[] = [];

  // Company identity: a name is necessary context, but not independent verification.
  if (buyer.companyName.trim()) {
    score += 10;
    verifiedSignals.push("Company name is available.");
  } else {
    missingSignals.push("Company name is unavailable.");
  }

  // A provider-supplied company link is stronger identity evidence.
  if (buyer.companyLink) {
    score += 25;
    verifiedSignals.push("A company record link is available.");
  } else {
    missingSignals.push("Company record link is unavailable.");
  }

  // Product-specific shipment activity is the key behavioral verification signal.
  if (buyer.matchingShipments !== null) {
    if (buyer.matchingShipments >= 20) {
      score += 30;
      verifiedSignals.push(
        "Strong product-matched shipment activity is recorded."
      );
    } else if (buyer.matchingShipments >= 5) {
      score += 22;
      verifiedSignals.push(
        "Meaningful product-matched shipment activity is recorded."
      );
    } else if (buyer.matchingShipments > 0) {
      score += 12;
      verifiedSignals.push(
        "Product-matched shipment activity is recorded."
      );
    } else {
      missingSignals.push(
        "No product-matched shipment activity is recorded."
      );
    }
  } else {
    missingSignals.push(
      "Product-matched shipment activity is unavailable."
    );
  }

  // Lifetime shipment activity is supporting evidence only.
  if (buyer.shipmentCount !== null && buyer.shipmentCount > 0) {
    score += 10;
    verifiedSignals.push("Overall shipment activity is recorded.");
  } else {
    missingSignals.push("Overall shipment activity is unavailable.");
  }

  // Recent shipment evidence helps establish that the buyer is not only historical.
  if (buyer.lastShipmentDate) {
    score += 15;
    verifiedSignals.push("Recent shipment date evidence is available.");
  } else {
    missingSignals.push("Recent shipment date evidence is unavailable.");
  }

  // Product-match text alone is not treated as independent verification.
  if (!buyer.productMatch) {
    missingSignals.push("Product match description is unavailable.");
  }

  score = Math.min(100, Math.round(score));

  // Verified requires multiple independent evidence layers.
  const hasCompanyLink = Boolean(buyer.companyLink);
  const hasProductActivity =
    buyer.matchingShipments !== null &&
    buyer.matchingShipments > 0;
  const hasRecentActivity = Boolean(buyer.lastShipmentDate);

  const status: BuyerVerificationStatus =
    hasCompanyLink &&
    hasProductActivity &&
    hasRecentActivity &&
    score >= 75
      ? "verified"
      : score >= 45
        ? "partially-verified"
        : "unverified";

  return {
    status,
    score,
    verifiedSignals,
    missingSignals,
  };
}
