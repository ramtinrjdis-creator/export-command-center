import { describe, expect, it } from "vitest";
import { buildBuyerExecution } from "../buyers/execution";
import { buildBuyerProviderCacheKey } from "../buyers/provider-cache";
import type { BuyerRecord } from "../buyers/types";

const buyer: BuyerRecord = {
  id: "buyer-1",
  companyName: "Example Importer",
  companyLink: "https://www.importyeti.com/company/example-importer",
  countryCode: 840,
  country: "United States",
  shipmentCount: 120,
  matchingShipments: 40,
  lastShipmentDate: "2026-06-01",
  productMatch: "Coffee",
  relevanceScore: 92,
  specialization: 88,
  supplierCount: 8,
  source: "importyeti",
  evidenceStatus: "strong",
};

describe("buyer intelligence v13", () => {
  it("prioritizes a strong recent buyer", () => {
    const result = buildBuyerExecution(buyer);
    expect(result.priority).toBe("high");
    expect(result.verificationSignal).toBe("recent-activity");
    expect(result.outreachReady).toBe(false);
  });

  it("does not upgrade a buyer without source recency", () => {
    const result = buildBuyerExecution({ ...buyer, lastShipmentDate: null });
    expect(result.priority).not.toBe("high");
    expect(result.blockers.join(" ")).toMatch(/Recent shipment date/i);
  });

  it("normalizes provider cache keys", () => {
    const a = buildBuyerProviderCacheKey({
      provider: "importyeti",
      hsCode: "090111",
      marketCode: 840,
      productDescription: "Coffee",
      limit: 10,
    });
    const b = buildBuyerProviderCacheKey({
      provider: "importyeti",
      hsCode: "090111",
      marketCode: 840,
      productDescription: "coffee",
      limit: 10,
    });
    expect(a).toBe(b);
  });
});
