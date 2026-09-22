import { describe, expect, it } from "vitest";
import { buildCommercialReadiness } from "../commercial-readiness";
import { buildMarketAccess } from "../market-access";

describe("commercial boundary contracts", () => {
  it("keeps buyer validation as a blocker when buyer evidence is absent", () => {
    const result = buildCommercialReadiness({
      evidenceScore: 84,
      originStatus: "recorded",
      buyerEvidenceEstablished: false,
      marketAccessStatus: "not-connected",
    });

    expect(result.stage).toBe("buyer-validation");
    expect(result.blockers).toContain("Qualified buyer evidence is not established.");
    expect(result.blockers).toContain(
      "Market-access requirements are not yet verified in this build.",
    );
  });

  it("does not invent tariff or regulatory evidence", () => {
    const result = buildMarketAccess({
      marketName: "United States",
      providerConfigured: false,
    });

    expect(result.status).toBe("not-connected");
    expect(result.coverage).toContain("No tariff");
    expect(result.limitations).toContain(
      "This build does not fabricate tariffs, taxes, regulations or non-tariff measures.",
    );
  });
});
