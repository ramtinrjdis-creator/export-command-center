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

export type BuyerProviderMeta = {
  provider: string;
  requestCost: number | null;
  creditsRemaining: number | null;
  requestId: string | null;
  fetchedAt: string;
  dataUpdatedAt?: string | null;
  endpoint?: string | null;
};

export type BuyerProviderResult =
  | {
      status: "available";
      buyers: BuyerRecord[];
      meta: BuyerProviderMeta;
    }
  | {
      status: "unavailable";
      buyers: [];
      reason:
        | "missing_credentials"
        | "provider_error"
        | "unsupported_market"
        | "missing_product_query"
        | "insufficient_credits"
        | "rate_limited";
      meta: BuyerProviderMeta;
    };

export interface BuyerDataProvider {
  name: string;

  searchBuyers(
    input: BuyerSearchInput
  ): Promise<BuyerProviderResult>;
}
