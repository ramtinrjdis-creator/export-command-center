import { describe, expect, it } from "vitest";
import {
  buildMarketSnapshot,
  compareMarketSnapshots,
} from "../monitoring";

describe("monitoring", () => {
  const context = {
    product: "Coffee",
    hsCode: "0901",
    originCode: "364",
    year: "2025",
  };

  it("detects material changed, new and removed markets", () => {
    const a = buildMarketSnapshot(
      [
        {
          countryCode: 276,
          country: "Germany",
          importValue: 1000,
          yoyGrowth: 2,
          opportunity: { score: 60 },
        },
        {
          countryCode: 826,
          country: "United Kingdom",
          importValue: 500,
          yoyGrowth: 1,
          opportunity: { score: 50 },
        },
      ],
      context,
    );

    const b = buildMarketSnapshot(
      [
        {
          countryCode: 276,
          country: "Germany",
          importValue: 1200,
          yoyGrowth: 5,
          opportunity: { score: 64 },
        },
        {
          countryCode: 380,
          country: "Italy",
          importValue: 900,
          yoyGrowth: 3,
          opportunity: { score: 55 },
        },
      ],
      context,
    );

    const r = compareMarketSnapshots(a, b);

    expect(r.hasBaseline).toBe(true);
    expect(r.changedMarkets[0]?.name).toBe("Germany");
    expect(r.newMarkets).toContain("Italy");
    expect(r.removedMarkets).toContain("United Kingdom");
  });

  it("does not compare unrelated scan definitions", () => {
    const a = buildMarketSnapshot(
      [
        {
          countryCode: 276,
          country: "Germany",
          importValue: 1000,
          yoyGrowth: 2,
          opportunity: { score: 60 },
        },
      ],
      context,
    );

    const b = buildMarketSnapshot(
      [
        {
          countryCode: 276,
          country: "Germany",
          importValue: 1400,
          yoyGrowth: 9,
          opportunity: { score: 80 },
        },
      ],
      { ...context, hsCode: "0802" },
    );

    const r = compareMarketSnapshots(a, b);

    expect(r.hasBaseline).toBe(false);
    expect(r.changedMarkets).toHaveLength(0);
  });

  it("ignores tiny numerical movement", () => {
    const a = buildMarketSnapshot(
      [
        {
          countryCode: 276,
          country: "Germany",
          importValue: 1000,
          yoyGrowth: 2,
          opportunity: { score: 60 },
        },
      ],
      context,
    );

    const b = buildMarketSnapshot(
      [
        {
          countryCode: 276,
          country: "Germany",
          importValue: 1003,
          yoyGrowth: 2.4,
          opportunity: { score: 61 },
        },
      ],
      context,
    );

    const r = compareMarketSnapshots(a, b);

    expect(r.hasBaseline).toBe(true);
    expect(r.changedMarkets).toHaveLength(0);
  });
});
