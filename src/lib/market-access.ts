export type MarketAccessStatus = "not-connected" | "verification-required" | "partially-verified";
export type MarketAccess = {
  status: MarketAccessStatus;
  provider: string;
  coverage: string;
  nextStep: string;
  limitations: string[];
};
export type MarketAccessInput = { marketName: string; providerConfigured?: boolean; providerName?: string };
export function buildMarketAccess(input: MarketAccessInput): MarketAccess {
  if (input.providerConfigured) return {
    status: "partially-verified",
    provider: input.providerName || "Configured market-access provider",
    coverage: "Provider connected; product-specific verification still required.",
    nextStep: "Verify tariff, taxes, product requirements, customs procedures and rules of origin.",
    limitations: [`${input.marketName}: provider-backed access data is available, but commercial fit still requires product-level verification.`],
  };
  return {
    status: "not-connected",
    provider: "No market-access provider connected",
    coverage: "No tariff, tax, regulatory or rules-of-origin claim is asserted.",
    nextStep: `Verify market-access requirements for ${input.marketName} before commercial outreach or pricing commitments.`,
    limitations: [
      "This build does not fabricate tariffs, taxes, regulations or non-tariff measures.",
      "A destination market signal alone is not evidence of commercial admissibility.",
    ],
  };
}
