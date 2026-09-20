export type OpportunitySignal =
  | "strong-validation-target"
  | "validation-target"
  | "monitor"
  | "insufficient-evidence";

export type OpportunityInput = {
  importValue: number;
  demandScore: number;
  growthRate: number | null;
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

export type OpportunityResult = {
  signal: OpportunitySignal;
  score: number;
  label: string;
  reasons: string[];
  missingEvidence: string[];
  nextAction: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function buildOpportunitySignal(
  input: OpportunityInput
): OpportunityResult {
  const reasons: string[] = [];
  const missingEvidence: string[] = [];

  let score = 0;

  // ------------------------------------------------------------
  // 1. Market demand
  // ------------------------------------------------------------
  if (input.importValue > 0 && input.demandScore >= 70) {
    score += 30;
    reasons.push("Large import demand relative to the analyzed markets.");
  } else if (input.importValue > 0 && input.demandScore >= 30) {
    score += 20;
    reasons.push("Meaningful import demand is present.");
  } else if (input.importValue > 0) {
    score += 10;
    reasons.push("Import demand is present but comparatively smaller.");
  } else {
    missingEvidence.push("Positive market import demand is unavailable.");
  }

  // ------------------------------------------------------------
  // 2. Market growth
  // ------------------------------------------------------------
  if (input.growthRate !== null) {
    if (input.growthRate >= 10) {
      score += 25;
      reasons.push("The market shows strong year-over-year growth.");
    } else if (input.growthRate >= 3) {
      score += 18;
      reasons.push("The market is growing year over year.");
    } else if (input.growthRate > -3) {
      score += 10;
      reasons.push("Market demand is relatively stable.");
    } else if (input.growthRate > -10) {
      score += 3;
      reasons.push("The market is declining.");
    } else {
      missingEvidence.push("The market shows strong year-over-year decline.");
    }
  } else {
    missingEvidence.push("Year-over-year growth evidence is unavailable.");
  }

  // ------------------------------------------------------------
  // 3. Data quality
  // ------------------------------------------------------------
  if (input.isReported && !input.isQuantityEstimated) {
    score += 15;
    reasons.push("Reported trade data is available.");
  } else if (!input.isQuantityEstimated) {
    score += 10;
    reasons.push("Trade data is available without quantity estimation.");
  } else {
    score += 5;
    missingEvidence.push(
      "Quantity/weight data contains an estimated component."
    );
  }

  // ------------------------------------------------------------
  // 4. Origin-specific evidence
  //
  // This is deliberately the most important gate.
  // No origin evidence must NEVER be interpreted as zero exports.
  // ------------------------------------------------------------
  if (input.originExportStatus === "recorded") {
    if (
      input.originExportValue !== null &&
      input.originExportValue > 0
    ) {
      score += 30;
      reasons.push(
        "Origin-specific export evidence from the selected origin is recorded."
      );

      if (
        input.originShare !== null &&
        input.originShare > 0
      ) {
        reasons.push(
          `The selected origin has a measurable share of market imports (${input.originShare}%).`
        );
      }
    } else {
      missingEvidence.push(
        "Origin-specific export record is present but has no positive value."
      );
    }
  } else if (input.originExportStatus === "no_record") {
    missingEvidence.push(
      "No origin-specific trade record was returned by the current data source."
    );
  } else if (input.originExportStatus === "rate_limited") {
    missingEvidence.push(
      "Origin-specific trade evidence could not be validated because the data source rate-limited the request."
    );
  } else if (input.originExportStatus === "data_unavailable") {
    missingEvidence.push(
      "The current Comtrade source has no origin dataset for the selected reporter and year."
    );
  } else if (input.originExportStatus === "unavailable") {
    missingEvidence.push(
      "Origin-specific trade evidence is currently unavailable."
    );
  } else {
    missingEvidence.push(
      "No origin-specific trade evidence was requested."
    );
  }

  score = clamp(Math.round(score));

  // ------------------------------------------------------------
  // Decision gates
  //
  // A market cannot become a strong validation target solely from
  // market size. Positive origin evidence is required.
  // ------------------------------------------------------------
  const hasPositiveOriginEvidence =
    input.originExportStatus === "recorded" &&
    input.originExportValue !== null &&
    input.originExportValue > 0;

  const strongMarket =
    input.demandScore >= 50 &&
    input.growthRate !== null &&
    input.growthRate >= 3;

  const decliningMarket =
    input.growthRate !== null &&
    input.growthRate <= -10;

  let signal: OpportunitySignal;
  let label: string;
  let nextAction: string;

  if (decliningMarket) {
    signal = "monitor";
    label = "Market requires caution";
    nextAction =
      "Investigate the reason for the decline before spending buyer-discovery effort.";
  } else if (
    hasPositiveOriginEvidence &&
    strongMarket &&
    score >= 75
  ) {
    signal = "strong-validation-target";
    label = "Strong validation target";
    nextAction =
      "Validate qualified buyers, competition, and market-access requirements before outreach.";
  } else if (
    hasPositiveOriginEvidence &&
    score >= 55
  ) {
    signal = "validation-target";
    label = "Validation target";
    nextAction =
      "Identify qualified buyers and verify market-access requirements.";
  } else if (
    !hasPositiveOriginEvidence &&
    strongMarket
  ) {
    signal = "monitor";
    label = "Strong market signal, origin evidence missing";
    nextAction =
      "Verify origin-specific trade evidence before treating this market as an export opportunity.";
  } else if (score >= 30) {
    signal = "monitor";
    label = "Market signal worth validating";
    nextAction =
      "Collect stronger origin and buyer evidence before prioritizing outreach.";
  } else {
    signal = "insufficient-evidence";
    label = "Insufficient evidence";
    nextAction =
      "Collect additional trade evidence before making an export decision.";
  }

  return {
    signal,
    score,
    label,
    reasons,
    missingEvidence,
    nextAction,
  };
}
