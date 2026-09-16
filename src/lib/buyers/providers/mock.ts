import type {
  BuyerDataProvider,
  BuyerProviderResult,
  BuyerSearchInput,
} from "../types";

export class MockBuyerProvider implements BuyerDataProvider {
  name = "mock-development";

  async searchBuyers(
    _input: BuyerSearchInput
  ): Promise<BuyerProviderResult> {
    if (process.env.NODE_ENV !== "development") {
      return {
        status: "unavailable",
        buyers: [],
        reason: "provider_error",
      };
    }

    return {
      status: "available",
      buyers: [
        {
          id: "dev-buyer-001",
          companyName: "Development Buyer",
      companyLink: "https://example.com/development-buyer",
          countryCode: 276,
          country: "Germany",
          shipmentCount: 24,
          matchingShipments: 12,
          lastShipmentDate: "2026-08-15",
          productMatch: "HS code match",
          relevanceScore: 85,
          specialization: 80,
          supplierCount: 6,
          source: "development-test-only",
          evidenceStatus: "strong",
        },
      ],
    };
  }
}
