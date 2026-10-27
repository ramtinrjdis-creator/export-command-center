import { describe, expect, it } from "vitest";
import { buildCommercialDecision } from "../commercial/commercial-decision";
import { buildDecisionWorkspace } from "../commercial/decision-workspace";

describe("decision intelligence v12", () => {
  it("keeps high-demand markets in VALIDATE when commercial proof is incomplete", () => {
    const decision = buildCommercialDecision({
      marketPotential: 92,
      evidenceScore: 91,
      originStatus: "recorded",
      competitionStatus: "unavailable",
      buyerStatus: "unavailable",
      marketAccessStatus: "not-connected",
      growthRate: 14,
    });

    const workspace = buildDecisionWorkspace({
      plan: "free",
      decision,
      evidence: {
        market: "strong",
        origin: "strong",
        competition: "unavailable",
        buyers: "unavailable",
        marketAccess: "unavailable",
      },
    });

    expect(decision.signal).toBe("VALIDATE");
    expect(workspace.primarySignal).toBe("VALIDATE");
    expect(workspace.blockers).toContain(
      "Qualified buyer evidence is not established.",
    );
    expect(workspace.nextResearch.length).toBeGreaterThan(0);
    expect(workspace.nextAction).toBeTruthy();
  });

  it("never turns a missing evidence layer into GO", () => {
    const decision = buildCommercialDecision({
      marketPotential: 99,
      evidenceScore: 99,
      originStatus: "recorded",
      competitionStatus: "supported",
      buyerStatus: "unavailable",
      marketAccessStatus: "not-connected",
      growthRate: 20,
    });

    expect(decision.signal).not.toBe("GO");
  });

  it("permits GO only when the full commercial evidence chain is supported", () => {
    const decision = buildCommercialDecision({
      marketPotential: 88,
      evidenceScore: 90,
      originStatus: "recorded",
      competitionStatus: "supported",
      buyerStatus: "strong",
      marketAccessStatus: "partially-verified",
      growthRate: 8,
    });

    expect(decision.signal).toBe("GO");

    const workspace = buildDecisionWorkspace({
      plan: "pro_monthly",
      decision,
      evidence: {
        market: "strong",
        origin: "strong",
        competition: "strong",
        buyers: "strong",
        marketAccess: "moderate",
      },
    });

    expect(workspace.primarySignal).toBe("GO");
    expect(workspace.upgradeReasons).toEqual([]);
  });
});
