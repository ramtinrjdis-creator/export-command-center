import { describe, expect, it } from "vitest";
import { analyzeBuyer } from "../buyers/intelligence";
import { evaluateBuyerEvidence } from "../buyers/evidence";
import { verifyBuyer } from "../buyers/verification";
import { buildBuyerSummary } from "../buyers/summary";
import { isImportYetiSupportedMarket } from "../buyers/providers/importyeti";
import type { BuyerRecord } from "../buyers/types";

function makeBuyer(
  overrides: Partial<BuyerRecord> = {}
): BuyerRecord {
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 30);

  return {
    id: "buyer-001",
    companyName: "Example Buyer",
    companyLink: "https://example.com/buyer",
    countryCode: 840,
    country: "United States",
    shipmentCount: 100,
    matchingShipments: 25,
    lastShipmentDate: recentDate.toISOString(),
    productMatch: "Relevant product",
    relevanceScore: 85,
    specialization: 80,
    supplierCount: 12,
    source: "test",
    evidenceStatus: "strong",
    ...overrides,
  };
}

describe("buyer provider market compatibility", () => {
  it("accepts both ISO numeric US representations used by integrations", () => {
    expect(isImportYetiSupportedMarket(840)).toBe(true);
    expect(isImportYetiSupportedMarket(842)).toBe(true);
    expect(isImportYetiSupportedMarket(276)).toBe(false);
  });
});

describe("buyer intelligence", () => {
  it("classifies strong buyer evidence as high-signal", () => {
    const result = analyzeBuyer(makeBuyer());

    expect(result.signal).toBe("high-signal");
    expect(result.signalScore).toBe(100);
    expect(result.nextAction).toContain("decision-maker");
  });
});

describe("buyer verification", () => {
  it("verifies a buyer with provider record, product activity, and recent shipment evidence", () => {
    const result = verifyBuyer(makeBuyer());

    expect(result.status).toBe("verified");
    expect(result.score).toBe(100);
    expect(result.verifiedSignals).toContain(
      "A provider company record is available."
    );
  });

  it("does not verify a buyer when shipment evidence is older than 12 months", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 400);

    const result = verifyBuyer(
      makeBuyer({
        lastShipmentDate: oldDate.toISOString(),
      })
    );

    expect(result.status).toBe("partially-verified");
    expect(result.missingSignals).toContain(
      "Shipment date exists but is older than 12 months."
    );
  });

  it("does not verify a buyer when the provider company record is missing", () => {
    const result = verifyBuyer(
      makeBuyer({
        companyLink: null,
      })
    );

    expect(result.status).toBe("partially-verified");
    expect(result.missingSignals).toContain(
      "A provider company record link is unavailable."
    );
  });
});

describe("buyer evidence", () => {
  it("treats strong product-matched activity as strong evidence", () => {
    const result = evaluateBuyerEvidence(makeBuyer());

    expect(result.status).toBe("strong");
    expect(result.score).toBe(100);
  });

  it("uses the canonical evidence score for buyer intelligence", () => {
    const evidence = evaluateBuyerEvidence(makeBuyer());
    const intelligence = analyzeBuyer(makeBuyer());

    expect(intelligence.signalScore).toBe(evidence.score);
  });
});

describe("buyer summary", () => {
  it("marks a fully supported buyer as an action candidate", () => {
    const result = buildBuyerSummary(makeBuyer());

    expect(result.readiness).toBe("action-candidate");
    expect(result.intelligence.signal).toBe("high-signal");
    expect(result.evidence.status).toBe("strong");
    expect(result.verification.status).toBe("verified");
  });

  it("does not mark a buyer as an action candidate when recency is unavailable", () => {
    const result = buildBuyerSummary(
      makeBuyer({
        lastShipmentDate: null,
      })
    );

    expect(result.readiness).toBe("needs-verification");
    expect(result.verification.status).not.toBe("verified");
  });
});
