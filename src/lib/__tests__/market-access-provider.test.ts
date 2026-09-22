import { describe, expect, it } from "vitest";
import { UnconfiguredMarketAccessProvider } from "../providers/market-access-provider";

describe("market access provider", () => {
  it("returns an explicit unconfigured state without inventing rates", async () => {
    const provider = new UnconfiguredMarketAccessProvider();

    const result = await provider.getAccess({
      marketCode: 840,
      marketName: "United States",
      hsCode: "0901",
    });

    expect(result.status).toBe("not-configured");
    expect(result.tariffRate).toBeNull();
    expect(result.preferentialRate).toBeNull();
    expect(result.tradeRemedyStatus).toBe(
      "not-verified",
    );
    expect(result.nonTariffMeasureStatus).toBe(
      "not-verified",
    );
  });
});
