import type { BuyerDataProvider } from "./types";
import { UnavailableBuyerProvider } from "./unavailable";

export function getBuyerProvider(): BuyerDataProvider {
  return new UnavailableBuyerProvider();
}
