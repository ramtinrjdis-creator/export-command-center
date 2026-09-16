import type { BuyerDataProvider } from "../types";
import { UnavailableBuyerProvider } from "../unavailable";
import { VolzaBuyerProvider } from "./volza";
import { MockBuyerProvider } from "./mock";
import { ImportYetiBuyerProvider } from "./importyeti";

export function getConfiguredBuyerProvider(): BuyerDataProvider {
  const configuredProvider = process.env.BUYER_PROVIDER;

  if (process.env.NODE_ENV === "development") {
    if (configuredProvider === "mock") {
      return new MockBuyerProvider();
    }
  }

  if (configuredProvider === "importyeti") {
    return new ImportYetiBuyerProvider();
  }

  if (configuredProvider === "volza") {
    return new VolzaBuyerProvider();
  }

  if (process.env.IMPORTYETI_API_KEY) {
    return new ImportYetiBuyerProvider();
  }

  if (process.env.VOLZA_API_KEY) {
    return new VolzaBuyerProvider();
  }

  return new UnavailableBuyerProvider();
}
