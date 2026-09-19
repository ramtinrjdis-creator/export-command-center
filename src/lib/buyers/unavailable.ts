import type {
  BuyerDataProvider,
  BuyerProviderResult,
} from "./types";

export class UnavailableBuyerProvider implements BuyerDataProvider {
  name = "unavailable";

  async searchBuyers(): Promise<BuyerProviderResult> {
    return {
      status: "unavailable",
      buyers: [],
      reason: "missing_credentials",
      meta: {
        provider: this.name,
        requestCost: null,
        creditsRemaining: null,
        requestId: null,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}
