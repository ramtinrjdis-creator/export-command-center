import type {
  BuyerDataProvider,
  BuyerRecord,
  BuyerSearchInput,
} from "./types";

export class UnavailableBuyerProvider implements BuyerDataProvider {
  name = "unavailable";

  async searchBuyers(
    _input: BuyerSearchInput
  ): Promise<BuyerRecord[]> {
    return [];
  }
}
