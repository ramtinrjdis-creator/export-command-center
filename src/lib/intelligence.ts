export type EvidenceStatus =
  | "strong"
  | "moderate"
  | "limited"
  | "unavailable";

export type DecisionSignal =
  | "promising"
  | "watch"
  | "insufficient-evidence";

export type MarketPriority =
  | "priority"
  | "monitor"
  | "research";

export type EvidenceItem = {
  key: string;
  label: string;
  value: string;
  status: EvidenceStatus;
  source: string;
  note?: string;
};

export type MarketIntelligenceInput = {
  importValue: number;
  previousImportValue: number | null;
  growthRate: number | null;
  demandScore: number;
  isReported: boolean;
  isQuantityEstimated: boolean;
  originExportValue: number | null;
  originExportStatus:
    | "recorded"
    | "no_record"
    | "rate_limited"
    | "data_unavailable"
    | "unavailable"
    | null;
  originShare: number | null;
};

export type MarketComparison = {
  demand: "strong" | "moderate" | "weak";
  growth: "strong" | "positive" | "stable" | "negative" | "unknown";
  evidence:
    | "strong"
    | "moderate"
    | "limited"
    | "unavailable";
  originSignal:
    | "recorded"
    | "no_record"
    | "rate_limited"
    | "data_unavailable"
    | "unavailable";
  summary: string;
  factors: string[];
};

export function compareMarket(
  input: MarketIntelligenceInput
): MarketComparison {
  const demand =
    input.demandScore >= 70
      ? "strong"
      : input.demandScore >= 40
        ? "moderate"
        : "weak";

  const growth =
    input.growthRate === null
      ? "unknown"
      : input.growthRate >= 10
        ? "strong"
        : input.growthRate >= 0
          ? "positive"
          : input.growthRate >= -10
            ? "stable"
            : "negative";

  const originSignal =
    input.originExportStatus === "recorded"
      ? "recorded"
      : input.originExportStatus === "no_record"
        ? "no_record"
        : input.originExportStatus === "rate_limited"
          ? "rate_limited"
          : input.originExportStatus === "data_unavailable"
            ? "data_unavailable"
            : "unavailable";

  const factors: string[] = [];

  if (demand === "strong") {
    factors.push("High relative import demand.");
  } else if (demand === "moderate") {
    factors.push("Moderate relative import demand.");
  } else {
    factors.push("Low relative import demand.");
  }

  if (growth === "strong") {
    factors.push("Import demand is growing strongly.");
  } else if (growth === "positive") {
    factors.push("Import demand is growing.");
  } else if (growth === "stable") {
    factors.push("Import demand is relatively stable.");
  } else if (growth === "negative") {
    factors.push("Import demand is declining.");
  } else {
    factors.push("Growth evidence is unavailable.");
  }

  let evidence: MarketComparison["evidence"];

  if (input.importValue <= 0) {
    evidence = "unavailable";
  } else if (
    input.previousImportValue !== null &&
    input.previousImportValue > 0
  ) {
    if (input.originExportStatus === "recorded") {
      evidence = "strong";
    } else if (
      input.originExportStatus === "rate_limited" ||
      input.originExportStatus === "data_unavailable" ||
      input.originExportStatus === "unavailable"
    ) {
      evidence = "limited";
    } else {
      evidence = "moderate";
    }
  } else {
    evidence = "limited";
  }

  if (evidence === "strong") {
    factors.push("Market and origin evidence coverage is strong.");
  } else if (evidence === "moderate") {
    factors.push("Market evidence coverage is moderate.");
  } else if (evidence === "limited") {
    factors.push("Evidence coverage is limited.");
  } else {
    factors.push("Evidence coverage is unavailable.");
  }

  if (originSignal === "recorded") {
    factors.push("Origin-specific exports are recorded.");
  } else if (originSignal === "no_record") {
    factors.push(
      "No origin-specific export record was found."
    );
  } else if (originSignal === "rate_limited") {
    factors.push(
      "Origin-specific evidence could not be validated because the source rate-limited the request."
    );
  } else {
    factors.push(
      "Origin-specific evidence is unavailable."
    );
  }

  const summary =
    demand === "strong" &&
    (growth === "strong" || growth === "positive") &&
    originSignal === "recorded"
      ? "Strong market and origin evidence signals."
      : demand === "weak" || growth === "negative"
        ? "Current market signals require caution."
        : "The market shows mixed signals and should be validated further.";

  return {
    demand,
    growth,
    evidence,
    originSignal,
    summary,
    factors,
  };
}

export type MarketIntelligence = {
  marketPriority: MarketPriority;

  /**
   * Evidence coverage only.
   *
   * This is NOT a market attractiveness score and
   * must not be interpreted as probability of success.
   */
  evidenceScore: number;

  evidenceLabel: "High" | "Medium" | "Low";
  evidenceStatus: EvidenceStatus;

  decisionSignal: DecisionSignal;
  decisionLabel: string;
  nextAction: string;

  evidence: EvidenceItem[];
  limitations: string[];
};

function clamp(
  value: number,
  min = 0,
  max = 100
) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Evidence coverage is deliberately separated from market demand.
 *
 * Maximum:
 * - Import data: 25
 * - Historical growth: 20
 * - Data quality: 15
 * - Origin-specific evidence: 40
 *
 * The resulting number describes coverage of available evidence.
 * It does NOT rank profitability or predict export success.
 */
function calculateEvidenceCoverage(
  input: MarketIntelligenceInput
): number {
  let score = 0;

  if (input.importValue > 0) {
    score += 25;
  }

  if (
    input.previousImportValue !== null &&
    input.previousImportValue > 0 &&
    input.growthRate !== null
  ) {
    score += 20;
  }

  if (input.isReported && !input.isQuantityEstimated) {
    score += 15;
  } else if (!input.isQuantityEstimated) {
    score += 10;
  } else {
    score += 5;
  }

  if (
    input.originExportStatus === "recorded" &&
    input.originExportValue !== null &&
    input.originExportValue > 0
  ) {
    score += 40;
  }

  return clamp(Math.round(score));
}

function getEvidenceLabel(
  evidenceScore: number
): MarketIntelligence["evidenceLabel"] {
  if (evidenceScore >= 75) return "High";
  if (evidenceScore >= 50) return "Medium";
  return "Low";
}

function getEvidenceStatus(
  evidenceScore: number
): EvidenceStatus {
  if (evidenceScore >= 75) return "strong";
  if (evidenceScore >= 50) return "moderate";
  if (evidenceScore > 0) return "limited";
  return "unavailable";
}

function getDecisionSignal(
  input: MarketIntelligenceInput
): DecisionSignal {
  const declining =
    input.growthRate !== null &&
    input.growthRate <= -10;

  if (
    input.importValue <= 0 ||
    input.demandScore < 10 ||
    declining
  ) {
    return "insufficient-evidence";
  }

  const hasPositiveOriginEvidence =
    input.originExportStatus === "recorded" &&
    input.originExportValue !== null &&
    input.originExportValue > 0;

  /*
   * A market can show strong demand without proving
   * that the selected origin can compete there.
   *
   * Therefore positive origin evidence is required
   * before the market can be called "promising".
   */
  if (!hasPositiveOriginEvidence) {
    if (
      input.demandScore >= 50 &&
      (input.growthRate === null ||
        input.growthRate >= 5)
    ) {
      return "watch";
    }

    return "insufficient-evidence";
  }

  if (
    input.demandScore >= 50 &&
    (input.growthRate === null ||
      input.growthRate >= 5)
  ) {
    return "promising";
  }

  return "watch";
}

function getDecisionLabel(
  signal: DecisionSignal
): string {
  if (signal === "promising") {
    return "Promising export signal";
  }

  if (signal === "watch") {
    return "Market signal worth validating";
  }

  return "Insufficient evidence";
}

function getNextAction(
  signal: DecisionSignal,
  originExportStatus:
    | "recorded"
    | "no_record"
    | "rate_limited"
    | "data_unavailable"
    | "unavailable"
    | null
): string {
  if (originExportStatus === "rate_limited") {
    return "Retry origin-specific trade validation later; do not interpret rate limiting as zero exports.";
  }

  if (originExportStatus === "data_unavailable") {
    return "The current Comtrade source has no origin dataset for this reporter and year; use another source before interpreting the market gap.";
  }

  if (originExportStatus === "unavailable") {
    return "Verify origin-specific trade evidence and identify qualified buyers.";
  }

  if (originExportStatus === "no_record") {
    return "Check trade-data coverage, then verify buyers before treating the gap as an opportunity.";
  }

  if (signal === "promising") {
    return "Validate qualified buyers, competition, and market-access requirements before outreach.";
  }

  if (signal === "watch") {
    return "Validate buyer demand and origin-specific competitiveness before prioritizing outreach.";
  }

  return "Collect stronger market evidence before prioritizing outreach.";
}

export function buildMarketIntelligence(
  input: MarketIntelligenceInput
): MarketIntelligence {
  const evidenceScore =
    calculateEvidenceCoverage(input);

  const evidence: EvidenceItem[] = [];
  const limitations: string[] = [];

  // ------------------------------------------------------------
  // Import demand
  // ------------------------------------------------------------

  if (input.importValue > 0) {
    evidence.push({
      key: "import-demand",
      label: "Import demand",
      value:
        "$" +
        input.importValue.toLocaleString(),
      status: "strong",
      source: "UN Comtrade",
    });
  } else {
    limitations.push(
      "No positive import value was returned."
    );
  }

  // ------------------------------------------------------------
  // Growth
  // ------------------------------------------------------------

  if (
    input.previousImportValue !== null &&
    input.previousImportValue > 0 &&
    input.growthRate !== null
  ) {
    evidence.push({
      key: "growth",
      label: "Year-over-year growth",
      value:
        (input.growthRate > 0 ? "+" : "") +
        input.growthRate +
        "%",
      status:
        input.growthRate >= 10
          ? "strong"
          : input.growthRate >= 0
            ? "moderate"
            : "limited",
      source: "UN Comtrade",
    });
  } else {
    limitations.push(
      "Previous-year data was insufficient for a reliable growth calculation."
    );
  }

  // ------------------------------------------------------------
  // Data quality
  // ------------------------------------------------------------

  if (
    input.isReported &&
    !input.isQuantityEstimated
  ) {
    evidence.push({
      key: "data-quality",
      label: "Data quality",
      value: "Reported",
      status: "strong",
      source: "UN Comtrade",
    });
  } else if (input.isQuantityEstimated) {
    evidence.push({
      key: "data-quality",
      label: "Data quality",
      value:
        "Quantity/weight estimated",
      status: "moderate",
      source: "UN Comtrade",
      note:
        "Estimated quantity/weight does not by itself mean trade value is estimated.",
    });

    limitations.push(
      "Quantity or weight contains an estimation flag."
    );
  } else {
    evidence.push({
      key: "data-quality",
      label: "Data quality",
      value: "Trade data available",
      status: "limited",
      source: "UN Comtrade",
    });
  }

  // ------------------------------------------------------------
  // Origin evidence
  // ------------------------------------------------------------

  if (
    input.originExportStatus === "recorded" &&
    input.originExportValue !== null &&
    input.originExportValue > 0
  ) {
    evidence.push({
      key: "origin-signal",
      label: "Origin-to-market export signal",
      value:
        "$" +
        input.originExportValue.toLocaleString(),
      status: "strong",
      source: "UN Comtrade",
      note:
        input.originShare !== null
          ? "Origin share: " +
            input.originShare +
            "%"
          : undefined,
    });
  } else if (
    input.originExportStatus === "no_record"
  ) {
    limitations.push(
      "No bilateral origin record was returned; this must not be interpreted as zero exports."
    );
  } else if (
    input.originExportStatus === "rate_limited"
  ) {
    limitations.push(
      "Origin-specific evidence could not be validated because the data source rate-limited the request."
    );
  } else if (
    input.originExportStatus === "data_unavailable"
  ) {
    limitations.push(
      "The current Comtrade source has no origin dataset for the selected reporter and year."
    );
  } else if (
    input.originExportStatus === "unavailable"
  ) {
    limitations.push(
      "Origin-specific data was unavailable for this market."
    );
  } else {
    limitations.push(
      "Origin-specific evidence was not requested."
    );
  }

  const decisionSignal =
    getDecisionSignal(input);

  /*
   * Priority is a descriptive workflow state, not
   * a profitability ranking.
   *
   * Confirmed origin evidence is required before
   * a market enters the priority state.
   */
  const marketPriority: MarketPriority =
    decisionSignal === "promising"
      ? "priority"
      : decisionSignal === "watch"
        ? "monitor"
        : "research";

  return {
    marketPriority,
    evidenceScore,
    evidenceLabel:
      getEvidenceLabel(evidenceScore),
    evidenceStatus:
      getEvidenceStatus(evidenceScore),
    decisionSignal,
    decisionLabel:
      getDecisionLabel(decisionSignal),
    nextAction:
      getNextAction(
        decisionSignal,
        input.originExportStatus
      ),
    evidence,
    limitations,
  };
}
