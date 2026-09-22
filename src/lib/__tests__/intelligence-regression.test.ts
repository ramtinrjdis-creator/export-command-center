import { describe, expect, it } from "vitest";
import { buildMarketIntelligence, compareMarket } from "../intelligence";

describe("intelligence regression", () => {
  it("keeps missing origin evidence distinct from zero exports", () => {
    const result = buildMarketIntelligence({
      importValue: 1_000_000,
      previousImportValue: 900_000,
      growthRate: 11.1,
      demandScore: 90,
      isReported: true,
      isEstimated: false,
      originExportValue: null,
      originExportStatus: "unavailable",
      originShare: null,
    });

    expect(result.limitations.join(" ")).toContain("unavailable");
    expect(result.evidence.some((item) => item.key === "origin-signal")).toBe(false);
  });

  it("preserves the comparison API used by the existing test suite", () => {
    const comparison = compareMarket({
      importValue: 1_000_000,
      previousImportValue: 800_000,
      growthRate: 25,
      demandScore: 80,
      isReported: true,
      isEstimated: false,
      originExportValue: 100_000,
      originExportStatus: "recorded",
      originShare: 10,
    });

    expect(comparison.demand).toBe("strong");
    expect(comparison.growth).toBe("strong");
    expect(comparison.originSignal).toBe("recorded");
  });

  it("does not call a destination signal promising when origin fit is unproven", () => {
    const result = buildMarketIntelligence({
      importValue: 1_000_000_000,
      previousImportValue: 800_000_000,
      growthRate: 25,
      demandScore: 90,
      isReported: true,
      isEstimated: false,
      isQuantityEstimated: false,
      originExportValue: null,
      originExportStatus: "no_record",
      originShare: null,
    });

    expect(result.decisionSignal).toBe("watch");
    expect(result.decisionLabel).toBe("Worth monitoring");
  });

  it("does not downgrade reported trade value because only physical quantity is estimated", () => {
    const result = buildMarketIntelligence({
      importValue: 1_000_000,
      previousImportValue: 900_000,
      growthRate: 11.1,
      demandScore: 80,
      isReported: true,
      isEstimated: true,
      isQuantityEstimated: true,
      originExportValue: 100_000,
      originExportStatus: "recorded",
      originShare: 10,
    });

    expect(
      result.evidenceBreakdown.dataQuality.points,
    ).toBe(20);

    expect(
      result.limitations.join(" "),
    ).toContain("quantity/weight");
  });
});
