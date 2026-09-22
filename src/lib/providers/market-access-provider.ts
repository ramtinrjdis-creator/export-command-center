export type MarketAccessProviderStatus =
  | "not-configured"
  | "available"
  | "unavailable";

export type MarketAccessProviderResult = {
  status: MarketAccessProviderStatus;
  provider: string;
  marketCode: number;
  marketName: string;
  productCode: string;
  tariffRate: number | null;
  preferentialRate: number | null;
  tradeRemedyStatus:
    | "verified"
    | "not-verified"
    | "unavailable";
  nonTariffMeasureStatus:
    | "verified"
    | "not-verified"
    | "unavailable";
  limitations: string[];
};

export interface MarketAccessProvider {
  name: string;

  getAccess(input: {
    marketCode: number;
    marketName: string;
    hsCode: string;
  }): Promise<MarketAccessProviderResult>;
}

export class UnconfiguredMarketAccessProvider
  implements MarketAccessProvider
{
  name = "no-provider";

  async getAccess(input: {
    marketCode: number;
    marketName: string;
    hsCode: string;
  }): Promise<MarketAccessProviderResult> {
    return {
      status: "not-configured",
      provider: this.name,
      marketCode: input.marketCode,
      marketName: input.marketName,
      productCode: input.hsCode,
      tariffRate: null,
      preferentialRate: null,
      tradeRemedyStatus: "not-verified",
      nonTariffMeasureStatus: "not-verified",
      limitations: [
        "No market-access provider is configured.",
        "No tariff or regulatory value is asserted.",
      ],
    };
  }
}
