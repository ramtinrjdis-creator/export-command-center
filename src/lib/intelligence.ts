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
  isEstimated: boolean;
  originExportValue: number | null;
  originExportStatus:
    | "recorded"
    | "no_record"
    | "unavailable"
    | null;
  originShare: number | null;
};

export type MarketComparison = {
  demand: "strong" | "moderate" | "weak";
  growth: "strong" | "positive" | "stable" | "negative" | "unknown";
  evidence: "strong" | "moderate" | "limited" | "unavailable";
  originSignal: "recorded" | "no_record" | "unavailable";
  summary: string;
  factors: string[];
};

export function compareMarket(input: MarketIntelligenceInput): MarketComparison {
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
        : "unavailable";

  const factors: string[] = [];

  if (demand === "strong") factors.push("High relative import demand.");
  else if (demand === "moderate") factors.push("Moderate relative import demand.");
  else factors.push("Low relative import demand.");

  if (growth === "strong") factors.push("Import demand is growing strongly.");
  else if (growth === "positive") factors.push("Import demand is growing.");
  else if (growth === "stable") factors.push("Import demand is relatively stable.");
  else if (growth === "negative") factors.push("Import demand is declining.");
  else factors.push("Growth evidence is unavailable.");

  const evidence =
    input.importValue <= 0
      ? "unavailable"
      : input.previousImportValue === null
        ? "limited"
        : input.originExportStatus === "recorded"
          ? "strong"
          : "moderate";

  if (evidence === "strong") factors.push("Evidence coverage is strong.");
  else if (evidence === "moderate") factors.push("Evidence coverage is moderate.");
  else if (evidence === "limited") factors.push("Evidence coverage is limited.");
  else factors.push("Evidence coverage is unavailable.");

  if (originSignal === "recorded") factors.push("Origin-specific exports are recorded.");
  else if (originSignal === "no_record") factors.push("No origin-specific export record was found.");
  else factors.push("Origin-specific evidence is unavailable.");

  const summary =
    demand === "strong" && (growth === "strong" || growth === "positive") && evidence === "strong"
      ? "Strong demand and growth signals with solid evidence."
      : demand === "weak" || growth === "negative"
        ? "Current demand signals require caution before prioritization."
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
  evidenceScore: number;
  evidenceLabel: "High" | "Medium" | "Low";
  evidenceStatus: EvidenceStatus;
  decisionSignal: DecisionSignal;
  decisionLabel: string;
  nextAction: string;
  evidence: EvidenceItem[];
  limitations: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getEvidenceLabel(
  evidenceScore: number
): MarketIntelligence["evidenceLabel"] {
  if (evidenceScore >= 75) return "High";
  if (evidenceScore >= 50) return "Medium";
  return "Low";
}

function getEvidenceStatus(evidenceScore: number): EvidenceStatus {
  if (evidenceScore >= 75) return "strong";
  if (evidenceScore >= 50) return "moderate";
  if (evidenceScore > 0) return "limited";
  return "unavailable";
}

function getDecisionSignal(
  demandScore: number,
  growthRate: number | null,
  evidenceScore: number
): DecisionSignal {
  if (
    evidenceScore < 50 ||
    demandScore < 10 ||
    (growthRate !== null && growthRate < -10)
  ) {
    return "insufficient-evidence";
  }

  if (
    demandScore >= 50 &&
    (growthRate === null || growthRate >= 5) &&
    evidenceScore >= 60
  ) {
    return "promising";
  }

  return "watch";
}

function getDecisionLabel(signal: DecisionSignal): string {
  if (signal === "promising") return "Promising market signal";
  if (signal === "watch") return "Worth monitoring";
  return "Insufficient evidence";
}

function getNextAction(
  signal: DecisionSignal,
  originExportStatus:
    | "recorded"
    | "no_record"
    | "unavailable"
    | null
): string {
  if (signal === "insufficient-evidence") {
    return "Collect stronger market evidence before prioritizing outreach.";
  }

  if (originExportStatus === "unavailable") {
    return "Verify buyer access and origin-specific trade evidence.";
  }

  if (originExportStatus === "no_record") {
    return "Verify whether the missing origin record reflects coverage or a real gap.";
  }

  if (signal === "promising") {
    return "Validate buyers and market access before outreach.";
  }

  return "Monitor demand and validate buyers before prioritizing outreach.";
}

export function buildMarketIntelligence(
  input: MarketIntelligenceInput
): MarketIntelligence {
  let evidenceScore = 40;
  const evidence: EvidenceItem[] = [];
  const limitations: string[] = [];

  if (input.importValue > 0) {
    evidenceScore += 20;
    evidence.push({
      key: "import-demand",
      label: "Import demand",
      value: "$" + input.importValue.toLocaleString(),
      status: "strong",
      source: "UN Comtrade",
    });
  } else {
    limitations.push("No positive import value was returned.");
  }

  if (
    input.previousImportValue !== null &&
    input.previousImportValue > 0 &&
    input.growthRate !== null
  ) {
    evidenceScore += 15;
    evidence.push({
      key: "growth",
      label: "Year-over-year growth",
      value:
        (input.growthRate > 0 ? "+" : "") +
        input.growthRate +
        "%",
      status: "strong",
      source: "UN Comtrade",
    });
  } else {
    limitations.push(
      "Previous-year data was insufficient for a reliable growth calculation."
    );
  }

  if (input.isReported && !input.isEstimated) {
    evidenceScore += 10;
    evidence.push({
      key: "data-quality",
      label: "Data quality",
      value: "Reported",
      status: "strong",
      source: "UN Comtrade",
    });
  } else if (input.isEstimated) {
    evidenceScore += 3;
    evidence.push({
      key: "data-quality",
      label: "Data quality",
      value: "Quantity/weight estimated",
      status: "moderate",
      source: "UN Comtrade",
      note:
        "Estimated quantity/weight does not by itself mean trade value is estimated.",
    });
    limitations.push(
      "Quantity or weight contains an estimation flag."
    );
  }

  if (
    input.originExportStatus === "recorded" &&
    input.originExportValue !== null
  ) {
    evidenceScore += 10;
    evidence.push({
      key: "origin-signal",
      label: "Origin-to-market export signal",
      value:
        "$" + input.originExportValue.toLocaleString(),
      status: "strong",
      source: "UN Comtrade",
      note:
        input.originShare !== null
          ? "Origin share: " + input.originShare + "%"
          : undefined,
    });
  } else if (input.originExportStatus === "no_record") {
    limitations.push(
      "No bilateral origin record was returned; this must not be interpreted as zero exports."
    );
  } else if (input.originExportStatus === "unavailable") {
    limitations.push(
      "Origin-specific data was unavailable for this market."
    );
  }

  evidenceScore = clamp(Math.round(evidenceScore));

  const decisionSignal = getDecisionSignal(
    input.demandScore,
    input.growthRate,
    evidenceScore
  );

  const marketPriority: MarketPriority =
    decisionSignal === "promising" && evidenceScore >= 70
      ? "priority"
      : decisionSignal === "watch" && evidenceScore >= 50
        ? "monitor"
        : "research";

  return {
    marketPriority,
    evidenceScore,
    evidenceLabel: getEvidenceLabel(evidenceScore),
    evidenceStatus: getEvidenceStatus(evidenceScore),
    decisionSignal,
    decisionLabel: getDecisionLabel(decisionSignal),
    nextAction: getNextAction(
      decisionSignal,
      input.originExportStatus
    ),
    evidence,
    limitations,
  };
}
