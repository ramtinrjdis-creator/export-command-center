import { describe, expect, it } from "vitest";
import { buildCommercialDecision } from "../commercial/commercial-decision";

describe("commercial decision v9", () => {
  it("does not call a market commercial-ready when buyer/access evidence is missing", () => {
    const result = buildCommercialDecision({
      marketPotential: 88,
      evidenceScore: 88,
      originStatus: "recorded",
      competitionStatus: "unavailable",
      buyerStatus: "unavailable",
      marketAccessStatus: "not-connected",
      growthRate: 11,
    });

    expect(result.signal).toBe("VALIDATE");
    expect(result.blockers).toContain("Qualified buyer evidence is not established.");
    expect(result.evidenceGaps).toContain("Verify tariff, preference and regulatory conditions.");
  });

  it("allows GO only when the commercial evidence chain is closed", () => {
    const result = buildCommercialDecision({
      marketPotential: 86,
      evidenceScore: 90,
      originStatus: "recorded",
      competitionStatus: "supported",
      buyerStatus: "strong",
      marketAccessStatus: "partially-verified",
      growthRate: 8,
    });

    expect(result.signal).toBe("GO");
    expect(result.confidence).toBe("high");
  });

  it("keeps missing origin evidence separate from zero trade", () => {
    const result = buildCommercialDecision({
      marketPotential: 82,
      evidenceScore: 78,
      originStatus: "no_record",
      competitionStatus: "unavailable",
      buyerStatus: "unavailable",
      marketAccessStatus: "not-connected",
      growthRate: 12,
    });

    expect(result.signal).toBe("WATCH");
    expect(result.evidenceGaps[0]).toContain("No bilateral origin record");
  });
});
