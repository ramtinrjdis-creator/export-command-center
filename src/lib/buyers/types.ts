export type BuyerSearchInput = {
  hsCode: string;
  marketCountryCode: number;
  productDescription?: string;
  limit?: number;
};

export type BuyerRecord = {
  id: string;
  companyName: string;
  companyLink: string | null;
  countryCode: number;
  country: string | null;
  shipmentCount: number | null;
  matchingShipments: number | null;
  lastShipmentDate: string | null;
  productMatch: string | null;
  relevanceScore: number | null;
  specialization: number | null;
  supplierCount: number | null;
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
      reason:
        | "missing_credentials"
        | "provider_error"
        | "unsupported_market"
        | "missing_product_query";
    };

export interface BuyerDataProvider {
  name: string;
  searchBuyers(
    input: BuyerSearchInput
  ): Promise<BuyerProviderResult>;
}
