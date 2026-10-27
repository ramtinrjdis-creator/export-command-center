import { describe, expect, it } from "vitest";
import { buildCommercialDecision } from "../commercial/commercial-decision";

describe("commercial decision contract", () => {
  it("returns a stable user-facing decision vocabulary", () => {
    const result = buildCommercialDecision({
      marketPotential: 75,
      evidenceScore: 75,
      originStatus: "recorded",
      competitionStatus: "unavailable",
      buyerStatus: "unavailable",
      marketAccessStatus: "not-connected",
      growthRate: 5,
    });

    expect(["GO", "VALIDATE", "WATCH", "DATA_GAP"]).toContain(result.signal);
    expect(result.label).toBeTruthy();
    expect(result.nextAction).toBeTruthy();
    expect(Array.isArray(result.blockers)).toBe(true);
    expect(Array.isArray(result.evidenceGaps)).toBe(true);
  });
});
