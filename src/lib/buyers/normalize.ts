import type { BuyerRecord } from "./types";

export type BuyerProviderPayload = {
  id?: string | null;
  companyName?: string | null;
  companyLink?: string | null;
  countryCode?: number | null;
  country?: string | null;
  shipmentCount?: number | null;
  matchingShipments?: number | null;
  lastShipmentDate?: string | null;
  productMatch?: string | null;
  relevanceScore?: number | null;
  specialization?: number | null;
  supplierCount?: number | null;
  source?: string | null;
  evidenceStatus?: "strong" | "moderate" | "limited" | null;
};

export function normalizeBuyer(
  payload: BuyerProviderPayload,
  provider: string
): BuyerRecord {
  return {
    id: payload.id?.trim() || `${provider}-unknown`,
    companyName: payload.companyName?.trim() || "Unknown company",
    companyLink: payload.companyLink?.trim() || null,
    countryCode:
      typeof payload.countryCode === "number"
        ? payload.countryCode
        : 0,
    country: payload.country?.trim() || null,
    shipmentCount:
      typeof payload.shipmentCount === "number"
        ? Math.max(0, Math.round(payload.shipmentCount))
        : null,
    matchingShipments:
      typeof payload.matchingShipments === "number"
        ? Math.max(0, Math.round(payload.matchingShipments))
        : null,
    lastShipmentDate:
      payload.lastShipmentDate?.trim() || null,
    productMatch:
      payload.productMatch?.trim() || null,
    relevanceScore:
      typeof payload.relevanceScore === "number"
        ? payload.relevanceScore
        : null,
    specialization:
      typeof payload.specialization === "number"
        ? payload.specialization
        : null,
    supplierCount:
      typeof payload.supplierCount === "number"
        ? Math.max(0, Math.round(payload.supplierCount))
        : null,
    source: payload.source?.trim() || provider,
    evidenceStatus:
      payload.evidenceStatus ?? "limited",
  };
}
