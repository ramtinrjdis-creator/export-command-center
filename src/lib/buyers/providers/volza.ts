import type {
  BuyerDataProvider,
  BuyerProviderResult,
  BuyerSearchInput,
} from "../types";

export class VolzaBuyerProvider implements BuyerDataProvider {
  name = "volza";

  async searchBuyers(
    _input: BuyerSearchInput
  ): Promise<BuyerProviderResult> {
    const fetchedAt = new Date().toISOString();

    if (!process.env.VOLZA_API_KEY) {
      return {
        status: "unavailable",
        buyers: [],
        reason: "missing_credentials",
        meta: {
          provider: this.name,
          requestCost: null,
          creditsRemaining: null,
          requestId: null,
          fetchedAt,
        },
      };
    }

    return {
      status: "unavailable",
      buyers: [],
      reason: "provider_error",
      meta: {
        provider: this.name,
        requestCost: null,
        creditsRemaining: null,
        requestId: null,
        fetchedAt,
      },
    };
  }
}
