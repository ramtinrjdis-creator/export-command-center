import { describe, expect, it } from "vitest";

import {
  normalizeDataTruth,
  evidenceStrengthFromScore,
} from "@/lib/quality/data-truth";

import {
  getFreshnessBand,
} from "@/lib/quality/freshness";

import {
  deriveCommercialDecision,
} from "@/lib/commercial/decision-guard";

import {
  hasEntitlement,
} from "@/lib/commercial/entitlements";

import {
  resolveProviderBoundary,
} from "@/lib/commercial/provider-boundary";

describe("ECC final integrity", () => {
  it("does not convert a missing record into zero truth", () => {
    expect(
      normalizeDataTruth({
        available: true,
        hasRecord: false,
        isEstimated: false,
      })
    ).toBe("no_record");
  });

  it("preserves estimated semantics", () => {
    expect(
      normalizeDataTruth({
        available: true,
        hasRecord: true,
        isEstimated: true,
      })
    ).toBe("estimated");
  });

  it("handles unavailable data explicitly", () => {
    expect(
      normalizeDataTruth({
        available: false,
        hasRecord: false,
        isEstimated: false,
      })
    ).toBe("unavailable");
  });

  it("maps evidence score bands", () => {
    expect(evidenceStrengthFromScore(90)).toBe("strong");
    expect(evidenceStrengthFromScore(70)).toBe("moderate");
    expect(evidenceStrengthFromScore(25)).toBe("limited");
    expect(evidenceStrengthFromScore(null)).toBe(
      "unavailable"
    );
  });

  it("classifies freshness", () => {
    expect(getFreshnessBand(2026, 2026)).toBe(
      "current"
    );

    expect(getFreshnessBand(2025, 2026)).toBe(
      "current"
    );

    expect(getFreshnessBand(2024, 2026)).toBe(
      "recent"
    );

    expect(getFreshnessBand(2020, 2026)).toBe(
      "stale"
    );

    expect(getFreshnessBand(null, 2026)).toBe(
      "unknown"
    );
  });

  it("blocks unavailable commercial analysis", () => {
    expect(
      deriveCommercialDecision({
        evidenceScore: 90,
        originSupported: true,
        buyerEvidenceEstablished: true,
        marketAccessVerified: true,
        dataAvailable: false,
      })
    ).toBe("blocked");
  });

  it("monitors when origin evidence is absent", () => {
    expect(
      deriveCommercialDecision({
        evidenceScore: 90,
        originSupported: false,
        buyerEvidenceEstablished: true,
        marketAccessVerified: true,
        dataAvailable: true,
      })
    ).toBe("monitor");
  });

  it("requires evidence for progression", () => {
    expect(
      deriveCommercialDecision({
        evidenceScore: 40,
        originSupported: true,
        buyerEvidenceEstablished: true,
        marketAccessVerified: true,
        dataAvailable: true,
      })
    ).toBe("research");
  });

  it("requires buyer evidence before advance", () => {
    expect(
      deriveCommercialDecision({
        evidenceScore: 90,
        originSupported: true,
        buyerEvidenceEstablished: false,
        marketAccessVerified: true,
        dataAvailable: true,
      })
    ).not.toBe("advance");
  });

  it("requires market access verification before advance", () => {
    expect(
      deriveCommercialDecision({
        evidenceScore: 90,
        originSupported: true,
        buyerEvidenceEstablished: true,
        marketAccessVerified: false,
        dataAvailable: true,
      })
    ).not.toBe("advance");
  });

  it("keeps free plan buyer intelligence protected", () => {
    expect(
      hasEntitlement(
        "free",
        "market_scan"
      )
    ).toBe(true);

    expect(
      hasEntitlement(
        "free",
        "evidence_layers"
      )
    ).toBe(true);

    expect(
      hasEntitlement(
        "free",
        "buyer_intelligence"
      )
    ).toBe(false);

    expect(
      hasEntitlement(
        "free",
        "decision_pack"
      )
    ).toBe(false);
  });

  it("exposes pro intelligence capabilities", () => {
    expect(
      hasEntitlement(
        "pro",
        "buyer_intelligence"
      )
    ).toBe(true);

    expect(
      hasEntitlement(
        "pro",
        "supplier_landscape"
      )
    ).toBe(true);

    expect(
      hasEntitlement(
        "pro",
        "decision_pack"
      )
    ).toBe(true);

    expect(
      hasEntitlement(
        "pro",
        "advanced_research"
      )
    ).toBe(true);
  });

  it("falls back safely when provider fails", () => {
    const result =
      resolveProviderBoundary({
        paidEnabled: true,
        providerAvailable: false,
        providerError:
          "Provider unavailable",
      });

    expect(result.mode).toBe(
      "free-research"
    );

    expect(result.fallback).toBe(true);

    expect(result.reason).toBe(
      "Provider unavailable"
    );
  });

  it("never claims provider mode without provider availability", () => {
    const result =
      resolveProviderBoundary({
        paidEnabled: true,
        providerAvailable: false,
      });

    expect(result.mode).not.toBe(
      "provider"
    );
  });
});
