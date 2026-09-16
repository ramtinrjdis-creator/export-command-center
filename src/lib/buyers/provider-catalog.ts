import type { ProviderEvaluation } from "./provider-evaluation";

export const providerCatalog: ProviderEvaluation[] = [
  {
    provider: "volza",
    coverage: "broad",
    buyerDiscovery: "strong",
    shipmentEvidence: "strong",
    companyVerification: "strong",
    apiAccess: "available",
    pricing: "moderate",
    commercialUse: "available",
    notes: [
      "Official REST/JSON API with Bearer Token authentication.",
      "Buyer/Supplier Insights, shipment, company and contact APIs are documented.",
      "Official API pricing currently starts at $0.10 per search and $5 per Buyer Insights report.",
    ],
  },
  {
    provider: "trademo",
    coverage: "broad",
    buyerDiscovery: "strong",
    shipmentEvidence: "strong",
    companyVerification: "strong",
    apiAccess: "available",
    pricing: "unknown",
    commercialUse: "available",
    notes: [
      "Official Buyer/Supplier List and Profile APIs are documented.",
      "Buyer discovery supports HS codes, product keywords, countries and time periods.",
      "Public API pricing is not listed; sales contact is required.",
    ],
  },
  {
    provider: "importgenius",
    coverage: "broad",
    buyerDiscovery: "strong",
    shipmentEvidence: "strong",
    companyVerification: "limited",
    apiAccess: "available",
    pricing: "high",
    commercialUse: "available",
    notes: [
      "Global shipment datasets are available across multiple countries.",
      "Global Enterprise pricing currently starts at $1,999 per month.",
      "Enterprise-grade API/data delivery is available.",
    ],
  },
];
