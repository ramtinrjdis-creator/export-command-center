export type EvidenceStatus = "strong" | "moderate" | "limited" | "unavailable";
export type EvidenceItem = { key: string; label: string; value: string; status: EvidenceStatus; source: string; note?: string; };
export type MarketIntelligenceInput = {
  importValue: number;
  previousImportValue: number | null;
  growthRate: number | null;
  isReported: boolean;
  isEstimated: boolean;
  originExportValue: number | null;
  originExportStatus: "recorded" | "no_record" | "unavailable" | null;
  originShare: number | null;
};

export type MarketIntelligence = {
  confidence: number;
  confidenceLabel: "High" | "Medium" | "Low";
  evidenceStatus: EvidenceStatus;
  evidence: EvidenceItem[];
  limitations: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getConfidenceLabel(
  confidence: number
): MarketIntelligence["confidenceLabel"] {
  if (confidence >= 75) return "High";
  if (confidence >= 50) return "Medium";
  return "Low";
}

function getEvidenceStatus(confidence: number): EvidenceStatus {
  if (confidence >= 75) return "strong";
  if (confidence >= 50) return "moderate";
  if (confidence > 0) return "limited";
  return "unavailable";
}

export function buildMarketIntelligence(
  input: MarketIntelligenceInput
): MarketIntelligence {
  let confidence = 40;
  const evidence: EvidenceItem[] = [];
  const limitations: string[] = [];

  if (input.importValue > 0) {
    confidence += 20;
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
    confidence += 15;
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
    confidence += 10;
    evidence.push({
      key: "data-quality",
      label: "Data quality",
      value: "Reported",
      status: "strong",
      source: "UN Comtrade",
    });
  } else if (input.isEstimated) {
    confidence += 3;
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
    confidence += 10;
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

  confidence = clamp(Math.round(confidence));

  return {
    confidence,
    confidenceLabel: getConfidenceLabel(confidence),
    evidenceStatus: getEvidenceStatus(confidence),
    evidence,
    limitations,
  };
}
