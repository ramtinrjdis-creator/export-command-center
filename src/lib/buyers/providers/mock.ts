import type {
  BuyerDataProvider,
  BuyerProviderResult,
  BuyerSearchInput,
} from "../types";

export class MockBuyerProvider implements BuyerDataProvider {
  name = "mock";

  async searchBuyers(
    _input: BuyerSearchInput
  ): Promise<BuyerProviderResult> {
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
      meta: {
        provider: this.name,
        requestCost: 0,
        creditsRemaining: null,
        requestId: null,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}
