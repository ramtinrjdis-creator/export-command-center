export type BuyerEvidenceSource =
  | "shipment"
  | "company"
  | "product-match"
  | "recency"
  | "provider";

export type BuyerEvidenceItem = {
  source: BuyerEvidenceSource;
  status: "confirmed" | "partial" | "unavailable";
  value: string | number | null;
  description: string;
};

export type CanonicalBuyerEvidence = {
  provider: string;
  items: BuyerEvidenceItem[];
  overallStatus:
    | "strong"
    | "moderate"
    | "limited"
    | "unavailable";
};
