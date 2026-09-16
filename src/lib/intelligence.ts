export type EvidenceStatus =
  | "strong"
  | "moderate"
  | "limited"
  | "unavailable";

export type DecisionSignal =
  | "promising"
  | "watch"
  | "insufficient-evidence";

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

export type MarketIntelligence = {
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

  return {
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
