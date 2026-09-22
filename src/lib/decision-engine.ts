import type {
  CompetitionContext,
  MarketAccessContext,
} from "@/lib/context/market-context";

export type DecisionMarket = {
  importValue?: number | null;
  tradeValue?: number | null;
  yoyGrowth?: number | null;
  growth?: number | null;

  /**
   * Legacy fields kept for compatibility with existing callers/tests.
   * Production decision priority should use opportunity.score.
   */
  demandScore?: number | null;
  score?: number | null;

  /**
   * Canonical Market Potential produced by market-scoring.ts.
   */
  opportunity?: {
    score?: number | null;
    signal?: string | null;
  } | null;

  isReported?: boolean | null;
  isQuantityEstimated?: boolean | null;

  originExportStatus?: string | null;
  originExportValue?: number | null;
  originShare?: number | null;

  intelligence?: {
    evidenceScore?: number | null;
  } | null;

  /**
   * V6 context layers.
   *
   * These are deliberately optional because the decision engine must
   * remain compatible with markets produced before V6 context existed.
   */
  competition?: CompetitionContext | null;
  marketAccess?: MarketAccessContext | null;
};

export type DecisionState =
  | "validate-origin"
  | "resolve-data-gap"
  | "strengthen-evidence"
  | "validate-buyers"
  | "validate-market-access";

export type DecisionProfile = {
  priority: number;
  priorityLabel:
    | "Priority to validate"
    | "Validation candidate"
    | "Actionable signal"
    | "Data gap";
  confidence: number;
  confidenceLabel: "High" | "Medium" | "Low";
  decisionState: DecisionState;
  decisionThesis: string;
  researchPriority: "HIGH" | "MEDIUM" | "LOW";
  nextAction: string;
  unknowns: string[];
  counterSignals: string[];
  invalidationTriggers: string[];
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getGrowth(market: DecisionMarket) {
  return market.yoyGrowth ?? market.growth ?? null;
}

/**
 * Decision Engine deliberately does NOT rebuild market potential.
 *
 * Market potential belongs to market-scoring.ts.
 * Evidence quality belongs to intelligence.ts.
 * This layer answers:
 *
 * "Given those signals, what decision state are we in?"
 */
function getMarketPotential(market: DecisionMarket) {
  if (
    typeof market.opportunity?.score === "number" &&
    Number.isFinite(market.opportunity.score)
  ) {
    return clamp(market.opportunity.score);
  }

  /*
   * Compatibility fallback for callers/tests that predate the
   * canonical opportunity.score field.
   */
  return clamp(market.score ?? market.demandScore ?? 0);
}

function getOriginCertainty(status: string | null) {
  switch (status) {
    case "recorded":
      return 100;
    case "no_record":
      return 35;
    case "unavailable":
    case "data_unavailable":
      return 20;
    default:
      return 30;
  }
}

export function buildDecisionProfile(
  market: DecisionMarket
): DecisionProfile {
  const marketPotential = getMarketPotential(market);
  const growth = getGrowth(market);

  const evidence = clamp(
    market.intelligence?.evidenceScore ?? 0
  );

  const originStatus = market.originExportStatus ?? null;
  const originCertainty = getOriginCertainty(originStatus);

  /*
   * Decision priority is intentionally a decision-layer composition:
   *
   * 55% destination-market potential
   * 30% evidence confidence
   * 15% origin certainty
   *
   * No second growth/demand formula exists here.
   */
  const priority = clamp(
    marketPotential * 0.55 +
      evidence * 0.30 +
      originCertainty * 0.15
  );

  /*
   * Confidence answers "How much should we trust the current picture?"
   * It is deliberately separate from priority.
   */
  const sourceQuality =
    market.isReported === true &&
    market.isQuantityEstimated !== true
      ? 100
      : market.isQuantityEstimated === true
        ? 65
        : 55;

  const growthCoverage =
    growth == null ? 45 : 100;

  const confidence = clamp(
    evidence * 0.50 +
      sourceQuality * 0.20 +
      originCertainty * 0.15 +
      growthCoverage * 0.15
  );

  const confidenceLabel =
    confidence >= 75
      ? "High"
      : confidence >= 55
        ? "Medium"
        : "Low";

  let decisionState: DecisionState;

  if (
    originStatus === "unavailable" ||
    originStatus === "data_unavailable"
  ) {
    decisionState = "resolve-data-gap";
  } else if (originStatus !== "recorded") {
    decisionState = "validate-origin";
  } else if (evidence < 60) {
    decisionState = "strengthen-evidence";
  } else {
    decisionState = "validate-buyers";
  }

  const priorityLabel =
    decisionState === "validate-origin"
      ? "Priority to validate"
      : decisionState === "resolve-data-gap"
        ? "Data gap"
        : decisionState === "validate-buyers" &&
            evidence >= 70 &&
            confidence >= 75
          ? "Actionable signal"
          : "Validation candidate";

  const unknowns: string[] = [];

  if (originStatus !== "recorded") {
    unknowns.push(
      "Origin-specific export fit is not confirmed."
    );
  }

  if (evidence < 70) {
    unknowns.push(
      "Evidence coverage is not yet strong enough for a high-confidence decision."
    );
  }

  unknowns.push(
    "Qualified buyer evidence is not established."
  );

  unknowns.push(
    "Market-access and regulatory conditions need verification."
  );

  unknowns.push(
    "Competitive positioning versus other origins is not established."
  );

  const counterSignals: string[] = [];

  if (growth !== null && growth < 0) {
    counterSignals.push(
      `Recent demand is declining (${growth.toFixed(1)}%).`
    );
  }

  if (originStatus === "no_record") {
    counterSignals.push(
      "No bilateral origin record was found; this is an evidence gap, not proof of zero trade."
    );
  }

  if (
    originStatus === "unavailable" ||
    originStatus === "data_unavailable"
  ) {
    counterSignals.push(
      "Origin-specific evidence is currently unavailable."
    );
  }

  if (market.isQuantityEstimated === true) {
    counterSignals.push(
      "Quantity/weight contains an estimation flag."
    );
  }

  if (marketPotential < 50) {
    counterSignals.push(
      "Market potential is below the stronger validation range."
    );
  }

  if (evidence < 60) {
    counterSignals.push(
      "Current evidence coverage is too limited for strong prioritization."
    );
  }

  const invalidationTriggers: string[] = [
    "Origin-specific evidence remains absent after a deeper coverage check.",
    "Qualified buyer evidence does not establish a credible route to market.",
    "Tariff, certification, or regulatory constraints materially reduce commercial feasibility.",
    "Competing origins show a stronger commercial position for the same market.",
  ];

  let nextAction = "";
  let researchPriority: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";

  if (decisionState === "resolve-data-gap") {
    nextAction =
      "Resolve the origin-data coverage issue before interpreting the market signal.";
    researchPriority = "HIGH";
  } else if (decisionState === "validate-origin") {
    nextAction =
      "Verify origin-specific trade evidence before buyer outreach.";
    researchPriority = "HIGH";
  } else if (decisionState === "strengthen-evidence") {
    nextAction =
      "Close the main evidence gap before treating the market as validated.";
    researchPriority = "HIGH";
  } else if (decisionState === "validate-buyers") {
    nextAction =
      "Validate qualified buyers first, then test market-access constraints.";
    researchPriority = "MEDIUM";
  } else {
    nextAction =
      "Validate market-access conditions and qualified buyers.";
    researchPriority = "MEDIUM";
  }

  const decisionThesis =
    decisionState === "validate-origin"
      ? "Destination demand is attractive, but the export-origin fit is still the key unresolved variable."
      : decisionState === "resolve-data-gap"
        ? "The market signal cannot be interpreted confidently until the missing origin evidence is resolved."
        : decisionState === "strengthen-evidence"
          ? "The market has a useful signal, but the current evidence base is not strong enough for a commercial decision."
          : decisionState === "validate-buyers"
            ? "The evidence is strong enough to move from market screening into buyer validation."
            : "The market requires another validation pass before commercial action.";

  return {
    priority,
    priorityLabel,
    confidence,
    confidenceLabel,
    decisionState,
    decisionThesis,
    researchPriority,
    nextAction,
    unknowns: unknowns.slice(0, 4),
    counterSignals: counterSignals.slice(0, 3),
    invalidationTriggers: invalidationTriggers.slice(0, 4),
  };
}
