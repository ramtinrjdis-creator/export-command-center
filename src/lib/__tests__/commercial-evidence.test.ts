import { describe, expect, it } from "vitest";
import { buildCommercialEvidence } from "../commercial-evidence";

describe("commercial evidence graph", () => {
  it("keeps missing commercial layers explicit", () => {
    const result = buildCommercialEvidence({
      evidenceScore: 82,
      originStatus: "recorded",
      competitionStatus: "unavailable",
      buyerStatus: "unavailable",
      marketAccessStatus: "not-connected",
    });

    expect(result.layers.market).toBe("strong");
    expect(result.layers.origin).toBe("strong");
    expect(result.layers.competition).toBe("unavailable");
    expect(result.layers.buyers).toBe("unavailable");
    expect(result.status).toBe("partial");
    expect(result.blockers.length).toBeGreaterThan(1);
  });

  it("supports a fully verified commercial evidence state", () => {
    const result = buildCommercialEvidence({
      evidenceScore: 90,
      originStatus: "recorded",
      competitionStatus: "supported",
      buyerStatus: "strong",
      marketAccessStatus: "partially-verified",
    });

    expect(result.status).toBe("supported");
    expect(result.coverageScore).toBeGreaterThanOrEqual(80);
    expect(result.nextDecision).toContain(
      "commercial validation",
    );
  });

  it("does not turn a missing bilateral record into zero origin evidence", () => {
    const result = buildCommercialEvidence({
      evidenceScore: 78,
      originStatus: "no_record",
      competitionStatus: "supported",
      buyerStatus: "strong",
      marketAccessStatus: "partially-verified",
    });

    expect(result.layers.origin).toBe("limited");
    expect(result.blockers[0]).toContain(
      "Origin-specific",
    );
  });
});
