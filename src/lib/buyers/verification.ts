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

  /*
   * Verification is intentionally narrower than buyer intelligence.
   * Provider data can establish a supported buyer record, but it does
   * not prove official corporate identity, a decision-maker, or outreach
   * access unless those signals are explicitly present.
   */

  // Provider company record.
  if (buyer.companyLink) {
    score += 30;
    verifiedSignals.push(
      "A provider company record is available."
    );
  } else {
    missingSignals.push(
      "A provider company record link is unavailable."
    );
  }

  // Product-specific shipment activity.
  if (buyer.matchingShipments !== null) {
    if (buyer.matchingShipments >= 20) {
      score += 35;
      verifiedSignals.push(
        "Strong product-matched shipment activity is recorded."
      );
    } else if (buyer.matchingShipments >= 5) {
      score += 25;
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
    verifiedSignals.push(
      "Overall shipment activity is recorded."
    );
  } else {
    missingSignals.push(
      "Overall shipment activity is unavailable."
    );
  }

  // Recency must use the actual shipment date.
  if (isRecentShipment(buyer.lastShipmentDate)) {
    score += 25;
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

  /*
   * Product-match text is supporting context only.
   * It is deliberately not counted as verification because the text
   * itself does not independently prove buyer activity.
   */
  if (!buyer.productMatch) {
    missingSignals.push(
      "Product match description is unavailable."
    );
  }

  score = Math.min(100, Math.round(score));

  const hasProviderRecord = Boolean(buyer.companyLink);
  const hasProductActivity =
    buyer.matchingShipments !== null &&
    buyer.matchingShipments > 0;
  const hasRecentActivity = isRecentShipment(
    buyer.lastShipmentDate
  );

  /*
   * "Verified" means sufficiently supported by the provider's
   * available evidence. It does NOT mean officially verified company
   * identity or outreach readiness.
   */
  const status: BuyerVerificationStatus =
    hasProviderRecord &&
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
