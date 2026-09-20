import { describe, expect, it } from "vitest";
import { compareMarket } from "../intelligence";

describe("compareMarket", () => {
  it("identifies strong market and origin evidence", () => {
    const result = compareMarket({
      importValue: 1_000_000,
      previousImportValue: 900_000,
      growthRate: 11,
      demandScore: 80,
      isReported: true,
      isQuantityEstimated: false,
      originExportValue: 100_000,
      originExportStatus: "recorded",
      originShare: 10,
    });

    expect(result.demand).toBe("strong");
    expect(result.growth).toBe("strong");
    expect(result.evidence).toBe("strong");
    expect(result.originSignal).toBe("recorded");
    expect(result.summary).toBe(
      "Strong market and origin evidence signals."
    );
  });

  it("does not treat a missing origin record as zero exports", () => {
    const result = compareMarket({
      importValue: 1_000_000,
      previousImportValue: 900_000,
      growthRate: 5,
      demandScore: 70,
      isReported: true,
      isQuantityEstimated: false,
      originExportValue: null,
      originExportStatus: "no_record",
      originShare: null,
    });

    expect(result.originSignal).toBe("no_record");
    expect(result.evidence).toBe("moderate");
    expect(result.factors).toContain(
      "No origin-specific export record was found."
    );
  });

  it("distinguishes unavailable origin data from a missing bilateral record", () => {
    const result = compareMarket({
      importValue: 1_000_000,
      previousImportValue: 900_000,
      growthRate: 5,
      demandScore: 70,
      isReported: true,
      isQuantityEstimated: false,
      originExportValue: null,
      originExportStatus: "data_unavailable",
      originShare: null,
    });

    expect(result.originSignal).toBe("data_unavailable");
    expect(result.evidence).toBe("limited");
  });
});
