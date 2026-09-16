export type BuyerSearchInput = {
  hsCode: string;
  marketCountryCode: number;
  limit?: number;
};

export type BuyerRecord = {
  id: string;
  companyName: string;
  countryCode: number;
  country: string | null;
  shipmentCount: number | null;
  lastShipmentDate: string | null;
  productMatch: string | null;
  source: string;
  evidenceStatus: "strong" | "moderate" | "limited";
};

export type BuyerProviderResult =
  | {
      status: "available";
      buyers: BuyerRecord[];
    }
  | {
      status: "unavailable";
      buyers: [];
      reason: "missing_credentials" | "provider_error" | "unsupported_market";
    };

export interface BuyerDataProvider {
  name: string;
  searchBuyers(
    input: BuyerSearchInput
  ): Promise<BuyerProviderResult>;
}
