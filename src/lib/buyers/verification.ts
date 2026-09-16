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

  if (buyer.companyName.trim()) {
    score += 25;
    verifiedSignals.push("Company identity is available.");
  } else {
    missingSignals.push("Company identity is unavailable.");
  }

  if (buyer.country) {
    score += 15;
    verifiedSignals.push("Company country is available.");
  } else {
    missingSignals.push("Company country is unavailable.");
  }

  if (buyer.shipmentCount !== null && buyer.shipmentCount > 0) {
    score += 30;
    verifiedSignals.push("Shipment activity is recorded.");
  } else {
    missingSignals.push("Shipment activity is unavailable.");
  }

  if (buyer.lastShipmentDate) {
    score += 15;
    verifiedSignals.push("Shipment date evidence is available.");
  } else {
    missingSignals.push("Shipment date evidence is unavailable.");
  }

  if (buyer.productMatch) {
    score += 15;
    verifiedSignals.push("Product match evidence is available.");
  } else {
    missingSignals.push("Product match evidence is unavailable.");
  }

  score = Math.min(100, score);

  const status: BuyerVerificationStatus =
    score >= 80
      ? "verified"
      : score >= 50
        ? "partially-verified"
        : "unverified";

  return {
    status,
    score,
    verifiedSignals,
    missingSignals,
  };
}
