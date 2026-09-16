import type { BuyerDataProvider } from "../types";
import { UnavailableBuyerProvider } from "../unavailable";
import { VolzaBuyerProvider } from "./volza";

export function getConfiguredBuyerProvider(): BuyerDataProvider {
  if (process.env.VOLZA_API_KEY) {
    return new VolzaBuyerProvider();
  }

  return new UnavailableBuyerProvider();
}
