import { describe, expect, it } from "vitest";
import {
  PLAN_POLICIES,
  getMonthlyEquivalentLimit,
  hasCapability,
} from "../commercial/plan-policy";
import { evaluateUsage } from "../commercial/usage-policy";
import { evaluateProviderBudget } from "../commercial/provider-budget";
import { buildDecisionWorkspace } from "../commercial/decision-workspace";
import { buildCommercialDecision } from "../commercial/commercial-decision";

describe("commercial foundation v11", () => {
  it("keeps free plan unable to access paid buyer intelligence", () => {
    expect(hasCapability("free", "buyer_intelligence")).toBe(false);
    expect(hasCapability("pro_monthly", "buyer_intelligence")).toBe(true);
    expect(getMonthlyEquivalentLimit("free", "buyer_provider_queries")).toBe(0);
  });

  it("allows usage below the plan budget", () => {
    const result = evaluateUsage("pro_monthly", "deep_analyses", {
      metric: "deep_analyses",
      used: 4,
      reserved: 1,
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.remaining).toBe(
        PLAN_POLICIES.pro_monthly.monthlyEquivalent.deep_analyses - 5,
      );
    }
  });

  it("blocks usage when reservation exhausts the budget", () => {
    const limit = getMonthlyEquivalentLimit("pro_monthly", "deep_analyses");
    const result = evaluateUsage("pro_monthly", "deep_analyses", {
      metric: "deep_analyses",
      used: limit - 1,
      reserved: 1,
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe("limit_reached");
  });

  it("fails closed when provider economics are unknown", () => {
    const result = evaluateProviderBudget({
      providerEnabled: true,
      monthlyBudgetUsd: null,
      spentUsd: null,
      estimate: {
        provider: "example",
        operation: "buyer_search",
        costClass: "medium",
        credits: null,
        currencyUsd: null,
      },
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe("budget_unknown");
  });

  it("allows free provider operations without a budget", () => {
    const result = evaluateProviderBudget({
      providerEnabled: true,
      monthlyBudgetUsd: null,
      spentUsd: null,
      estimate: {
        provider: "example",
        operation: "metadata",
        costClass: "free",
        credits: 0,
        currencyUsd: 0,
      },
    });

    expect(result).toEqual({
      allowed: true,
      reason: "free",
    });
  });

  it("creates an explicit workspace rather than a vague Pro badge", () => {
    const decision = buildCommercialDecision({
      marketPotential: 82,
      evidenceScore: 88,
      originStatus: "recorded",
      competitionStatus: "unavailable",
      buyerStatus: "unavailable",
      marketAccessStatus: "not-connected",
      growthRate: 9,
    });

    const workspace = buildDecisionWorkspace({
      plan: "free",
      decision,
      evidence: {
        market: "strong",
        origin: "strong",
        competition: "not-checked",
        buyers: "unavailable",
        marketAccess: "unavailable",
      },
    });

    expect(workspace.primarySignal).toBe("VALIDATE");
    expect(workspace.blockers.length).toBeGreaterThan(0);
    expect(workspace.nextResearch.length).toBeGreaterThan(0);
    expect(workspace.upgradeReasons.length).toBeGreaterThan(0);
  });
});
