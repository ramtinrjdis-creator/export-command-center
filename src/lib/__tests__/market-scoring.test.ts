import { describe, expect, it } from "vitest";
import { scoreMarket } from "../market-scoring";

describe("market scoring", () => {
  it("rewards demand and positive multi-year momentum", () => {
    const result = scoreMarket({
      importValue: 1_000_000_000,
      maxImportValue: 1_000_000_000,
      growthRate: 12,
      cagr3y: 10,
      growthConsistency: 1,
      originStatus: "recorded",
      evidenceScore: 90,
      macro: {
        population: 100_000_000,
        gdpPerCapita: 20_000,
      },
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.signal).toBe("strong-validation-target");
  });

  it("does not confuse missing origin evidence with zero trade", () => {
    const result = scoreMarket({
      importValue: 500_000_000,
      maxImportValue: 1_000_000_000,
      growthRate: 8,
      cagr3y: 7,
      growthConsistency: 1,
      originStatus: "no_record",
      evidenceScore: 70,
      macro: null,
    });

    expect(result.riskFlags).toContain("No bilateral origin record");
    expect(result.signal).toBe("monitor");
    expect(result.score).toBeGreaterThan(0);
  });

  it("caps weak evidence from looking like a strong decision", () => {
    const result = scoreMarket({
      importValue: 1_000_000_000,
      maxImportValue: 1_000_000_000,
      growthRate: 20,
      cagr3y: 15,
      growthConsistency: 1,
      originStatus: "unavailable",
      evidenceScore: 35,
      macro: null,
    });

    expect(result.signal).toBe("insufficient-evidence");
    expect(result.score).toBeLessThan(60);
  });

  it("handles a one-market universe without producing NaN", () => {
    const result = scoreMarket({
      importValue: 1,
      maxImportValue: 1,
      growthRate: null,
      cagr3y: null,
      growthConsistency: null,
      originStatus: "recorded",
      evidenceScore: 70,
      macro: null,
    });

    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
