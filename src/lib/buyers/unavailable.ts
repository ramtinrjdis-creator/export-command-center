import type { BuyerDataProvider, BuyerProviderResult, BuyerSearchInput } from "./types";

export class UnavailableBuyerProvider implements BuyerDataProvider {
  name = "unavailable";

  async searchBuyers(_input: BuyerSearchInput): Promise<BuyerProviderResult> {
    return { status: "unavailable", buyers: [], reason: "missing_credentials" };
  }
}
