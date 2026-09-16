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
    if (!process.env.VOLZA_API_KEY) {
      return {
        status: "unavailable",
        buyers: [],
        reason: "missing_credentials",
      };
    }

    return {
      status: "unavailable",
      buyers: [],
      reason: "provider_error",
    };
  }
}
