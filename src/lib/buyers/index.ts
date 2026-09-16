import type { BuyerDataProvider } from "./types";
import { getConfiguredBuyerProvider } from "./providers";

export function getBuyerProvider(): BuyerDataProvider {
  return getConfiguredBuyerProvider();
}
