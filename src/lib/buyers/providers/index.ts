import type { BuyerDataProvider } from "../types";
import { UnavailableBuyerProvider } from "../unavailable";
import { VolzaBuyerProvider } from "./volza";
import { MockBuyerProvider } from "./mock";

export function getConfiguredBuyerProvider(): BuyerDataProvider {
  if (process.env.NODE_ENV === "development") {
    if (process.env.BUYER_PROVIDER === "mock") {
      return new MockBuyerProvider();
    }
  }

  if (process.env.VOLZA_API_KEY) {
    return new VolzaBuyerProvider();
  }

  return new UnavailableBuyerProvider();
}
