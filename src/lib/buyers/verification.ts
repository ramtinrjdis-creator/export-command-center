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

function isRecentShipment(dateValue: string | null): boolean {
  if (!dateValue) return false;

  const timestamp = Date.parse(dateValue);

  if (Number.isNaN(timestamp)) return false;

  const ageDays =
    (Date.now() - timestamp) / (1000 * 60 * 60 * 24);

  return ageDays >= 0 && ageDays <= 365;
}

export function verifyBuyer(
  buyer: BuyerRecord
): BuyerVerification {
  let score = 0;
  const verifiedSignals: string[] = [];
  const missingSignals: string[] = [];

  // Company identity
  if (buyer.companyName.trim()) {
    score += 10;
    verifiedSignals.push("Company name is available.");
  } else {
    missingSignals.push("Company name is unavailable.");
  }

  // Provider-supplied company record
  if (buyer.companyLink) {
    score += 25;
    verifiedSignals.push("A company record link is available.");
  } else {
    missingSignals.push("Company record link is unavailable.");
  }

  // Product-specific shipment activity
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

  // Recency must be based on the actual date, not merely its existence.
  if (isRecentShipment(buyer.lastShipmentDate)) {
    score += 15;
    verifiedSignals.push(
      "Shipment activity within the last 12 months is recorded."
    );
  } else if (buyer.lastShipmentDate) {
    missingSignals.push(
      "Shipment date exists but is older than 12 months."
    );
  } else {
    missingSignals.push(
      "Recent shipment date evidence is unavailable."
    );
  }

  // Product-match text alone is not independent verification.
  if (!buyer.productMatch) {
    missingSignals.push("Product match description is unavailable.");
  }

  score = Math.min(100, Math.round(score));

  const hasCompanyLink = Boolean(buyer.companyLink);
  const hasProductActivity =
    buyer.matchingShipments !== null &&
    buyer.matchingShipments > 0;
  const hasRecentActivity = isRecentShipment(
    buyer.lastShipmentDate
  );

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
