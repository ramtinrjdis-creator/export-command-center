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

export interface BuyerDataProvider {
  name: string;
  searchBuyers(input: BuyerSearchInput): Promise<BuyerRecord[]>;
}
