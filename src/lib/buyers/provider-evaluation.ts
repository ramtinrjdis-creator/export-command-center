export type ProviderEvaluation = {
  provider: string;
  coverage: "unknown" | "limited" | "broad";
  buyerDiscovery: "unknown" | "limited" | "strong";
  shipmentEvidence: "unknown" | "limited" | "strong";
  companyVerification: "unknown" | "limited" | "strong";
  apiAccess: "unknown" | "limited" | "available";
  pricing: "unknown" | "low" | "moderate" | "high";
  commercialUse: "unknown" | "restricted" | "available";
  notes: string[];
};

export function createProviderEvaluation(
  provider: string
): ProviderEvaluation {
  return {
    provider,
    coverage: "unknown",
    buyerDiscovery: "unknown",
    shipmentEvidence: "unknown",
    companyVerification: "unknown",
    apiAccess: "unknown",
    pricing: "unknown",
    commercialUse: "unknown",
    notes: [],
  };
}
