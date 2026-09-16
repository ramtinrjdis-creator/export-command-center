import type { BuyerRecord } from "./types";

export type BuyerProviderPayload = {
  id?: string | null;
  companyName?: string | null;
  countryCode?: number | null;
  country?: string | null;
  shipmentCount?: number | null;
  lastShipmentDate?: string | null;
  productMatch?: string | null;
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
    countryCode:
      typeof payload.countryCode === "number"
        ? payload.countryCode
        : 0,
    country: payload.country?.trim() || null,
    shipmentCount:
      typeof payload.shipmentCount === "number"
        ? Math.max(0, Math.round(payload.shipmentCount))
        : null,
    lastShipmentDate:
      payload.lastShipmentDate?.trim() || null,
    productMatch:
      payload.productMatch?.trim() || null,
    source: payload.source?.trim() || provider,
    evidenceStatus:
      payload.evidenceStatus ?? "limited",
  };
}
