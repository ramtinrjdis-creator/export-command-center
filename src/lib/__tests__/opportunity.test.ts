import { describe, expect, it } from "vitest";
import { buildOpportunitySignal } from "../opportunity";

describe("buildOpportunitySignal", () => {
  it("requires positive origin evidence for a strong validation target", () => {
    const result = buildOpportunitySignal({
      importValue: 2_000_000,
      demandScore: 80,
      growthRate: 10,
      isReported: true,
      isEstimated: false,
      originExportValue: 150_000,
      originExportStatus: "recorded",
      originShare: 7.5,
    });

    expect(result.signal).toBe("strong-validation-target");
    expect(result.score).toBe(100);
  });

  it("does not treat a strong market as an export opportunity without origin evidence", () => {
    const result = buildOpportunitySignal({
      importValue: 2_000_000,
      demandScore: 80,
      growthRate: 5,
      isReported: true,
      isEstimated: false,
      originExportValue: null,
      originExportStatus: "no_record",
      originShare: null,
    });

    expect(result.signal).toBe("monitor");
    expect(result.label).toBe(
      "Strong market signal, origin evidence missing"
    );
    expect(result.missingEvidence).toContain(
      "No origin-specific trade record was returned by the current data source."
    );
  });

  it("keeps strongly declining markets in monitor state", () => {
    const result = buildOpportunitySignal({
      importValue: 2_000_000,
      demandScore: 80,
      growthRate: -10,
      isReported: true,
      isEstimated: false,
      originExportValue: 150_000,
      originExportStatus: "recorded",
      originShare: 7.5,
    });

    expect(result.signal).toBe("monitor");
    expect(result.label).toBe("Market requires caution");
  });
});
