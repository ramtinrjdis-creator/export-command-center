import { providerCatalog } from "./provider-catalog";
import type { ProviderEvaluation } from "./provider-evaluation";

export type BuyerProviderRegistry = {
  get(provider: string): ProviderEvaluation | null;
  list(): ProviderEvaluation[];
};

export const buyerProviderRegistry: BuyerProviderRegistry = {
  get(provider: string) {
    return (
      providerCatalog.find(
        (item) => item.provider === provider
      ) ?? null
    );
  },

  list() {
    return [...providerCatalog];
  },
};
