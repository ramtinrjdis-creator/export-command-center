export type EvidenceStatus = "strong" | "moderate" | "limited" | "unavailable";
export type DecisionSignal = "promising" | "watch" | "insufficient-evidence";
export type MarketPriority = "priority" | "monitor" | "research";

export type EvidenceItem = {
  key: string;
  label: string;
  value: string;
  status: EvidenceStatus;
  source: string;
  note?: string;
};

export type EvidenceBreakdownItem = {
  points: number;
  maxPoints: number;
  status: EvidenceStatus;
  source: string;
  note: string;
};

export type EvidenceBreakdown = {
  demand: EvidenceBreakdownItem;
  growth: EvidenceBreakdownItem;
  dataQuality: EvidenceBreakdownItem;
  origin: EvidenceBreakdownItem;
  coverage: EvidenceBreakdownItem;
};

export type MarketIntelligenceInput = {
  importValue: number;
  previousImportValue: number | null;
  growthRate: number | null;
  demandScore: number;
  isReported: boolean | null;
  isEstimated?: boolean;
  isQuantityEstimated?: boolean;
  originExportValue: number | null;
  originExportStatus:
    | "recorded"
    | "no_record"
    | "unavailable"
    | "data_unavailable"
    | null;
  originShare: number | null;
};

export type MarketComparison = {
  demand: "strong" | "moderate" | "weak";
  growth: "strong" | "positive" | "stable" | "negative" | "unknown";
  evidence: "strong" | "moderate" | "limited" | "unavailable";
  originSignal: "recorded" | "no_record" | "data_unavailable";
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
        : "data_unavailable";

  const evidence =
    input.importValue <= 0
      ? "unavailable"
      : input.previousImportValue === null
        ? "limited"
        : input.originExportStatus === "unavailable" ||
            input.originExportStatus === "data_unavailable"
          ? "limited"
          : input.originExportStatus === "recorded"
            ? "strong"
            : "moderate";

  const factors: string[] = [];

  factors.push(
    demand === "strong"
      ? "High relative import demand."
      : demand === "moderate"
        ? "Moderate relative import demand."
        : "Low relative import demand."
  );

  factors.push(
    growth === "strong"
      ? "Import demand is growing strongly."
      : growth === "positive"
        ? "Import demand is growing."
        : growth === "stable"
          ? "Import demand is relatively stable."
          : growth === "negative"
            ? "Import demand is declining."
            : "Growth evidence is unavailable."
  );

  factors.push(
    evidence === "strong"
      ? "Evidence coverage is strong."
      : evidence === "moderate"
        ? "Evidence coverage is moderate."
        : evidence === "limited"
          ? "Evidence coverage is limited."
          : "Evidence coverage is unavailable."
  );

  factors.push(
    originSignal === "recorded"
      ? "Origin-specific exports are recorded."
      : originSignal === "no_record"
        ? "No origin-specific export record was found."
        : "Origin-specific evidence is unavailable."
  );

  const summary =
    demand === "strong" &&
    (growth === "strong" || growth === "positive") &&
    evidence === "strong" &&
    originSignal === "recorded"
      ? "Strong market and origin evidence signals."
      : demand === "weak" || growth === "negative"
        ? "Current demand signals require caution before prioritization."
        : "The market shows mixed signals and should be validated further.";

  return {
    demand,
    growth,
    evidence:
      input.originExportStatus === "data_unavailable" ||
      input.originExportStatus === "unavailable"
        ? "limited"
        : evidence,
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
  evidenceBreakdown: EvidenceBreakdown;
  decisionSignal: DecisionSignal;
  decisionLabel: string;
  nextAction: string;
  evidence: EvidenceItem[];
  limitations: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function decisionSignal(
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

function statusFromPoints(
  points: number,
  maxPoints: number
): EvidenceStatus {
  if (points <= 0) return "unavailable";

  const ratio = points / maxPoints;

  if (ratio >= 0.8) return "strong";
  if (ratio >= 0.5) return "moderate";
  return "limited";
}

export function buildMarketIntelligence(
  input: MarketIntelligenceInput
): MarketIntelligence {
  const evidence: EvidenceItem[] = [];
  const limitations: string[] = [];

  /*
   * Evidence score is deliberately a coverage/confidence measure.
   * It does NOT measure market attractiveness.
   *
   * Maximum:
   *   Demand       25
   *   Growth       25
   *   Data quality 20
   *   Origin       20
   *   Coverage     10
   *   ----------------
   *   Total       100
   */

  // 1. Demand evidence — 25 points.
  const demandPoints = input.importValue > 0 ? 25 : 0;

  const demandStatus = statusFromPoints(demandPoints, 25);

  if (input.importValue > 0) {
    evidence.push({
      key: "import-demand",
      label: "Import demand",
      value: `$${input.importValue.toLocaleString()}`,
      status: "strong",
      source: "UN Comtrade",
      note: "Current destination import value is available.",
    });
  } else {
    limitations.push("No positive import value was returned.");
  }

  // 2. Growth evidence — 25 points.
  const growthAvailable =
    input.previousImportValue !== null &&
    input.previousImportValue > 0 &&
    input.growthRate !== null;

  const growthPoints = growthAvailable ? 25 : 0;
  const growthStatus = statusFromPoints(growthPoints, 25);

  if (growthAvailable) {
    evidence.push({
      key: "growth",
      label: "Year-over-year growth",
      value: `${input.growthRate! > 0 ? "+" : ""}${input.growthRate}%`,
      status: "strong",
      source: "UN Comtrade",
      note: "Growth is calculated from current and previous-year import values.",
    });
  } else {
    limitations.push(
      "Previous-year data was insufficient for a reliable growth calculation."
    );
  }

  // 3. Data quality — 20 points.
  let dataQualityPoints = 0;
  let dataQualityStatus: EvidenceStatus = "unavailable";
  let dataQualityValue = "Not specified";
  let dataQualityNote =
    "The source did not provide enough quality metadata.";

  if (input.isReported === true && !input.isEstimated) {
    dataQualityPoints = 20;
    dataQualityStatus = "strong";
    dataQualityValue = "Reported";
    dataQualityNote = "Trade value is reported by the source without an estimation flag.";

    evidence.push({
      key: "data-quality",
      label: "Data quality",
      value: dataQualityValue,
      status: dataQualityStatus,
      source: "UN Comtrade",
      note: dataQualityNote,
    });
  } else if (input.isEstimated) {
    dataQualityPoints = 10;
    dataQualityStatus = "moderate";
    dataQualityValue = "Estimated";
    dataQualityNote =
      "An estimation flag is present. Estimated quantity/weight does not by itself mean trade value is estimated.";

    evidence.push({
      key: "data-quality",
      label: "Data quality",
      value: dataQualityValue,
      status: dataQualityStatus,
      source: "UN Comtrade",
      note: dataQualityNote,
    });

    limitations.push(
      "The source contains an estimation flag for reported trade data."
    );
  } else if (input.isReported === true) {
    dataQualityPoints = 15;
    dataQualityStatus = "moderate";
    dataQualityValue = "Reported";
    dataQualityNote =
      "The trade record is reported, but additional estimation metadata is present or unavailable.";

    evidence.push({
      key: "data-quality",
      label: "Data quality",
      value: dataQualityValue,
      status: dataQualityStatus,
      source: "UN Comtrade",
      note: dataQualityNote,
    });
  } else if (input.isReported === false) {
    dataQualityPoints = 8;
    dataQualityStatus = "limited";
    dataQualityValue = "Not reported";
    dataQualityNote =
      "The source did not identify this record as directly reported.";

    evidence.push({
      key: "data-quality",
      label: "Data quality",
      value: dataQualityValue,
      status: dataQualityStatus,
      source: "UN Comtrade",
      note: dataQualityNote,
    });

    limitations.push(
      "The current trade record is not marked as directly reported."
    );
  } else {
    limitations.push("Source reporting quality was not specified.");
  }

  // 4. Origin-specific evidence — 20 points.
  let originPoints = 0;
  let originStatus: EvidenceStatus = "unavailable";

  if (
    input.originExportStatus === "recorded" &&
    input.originExportValue !== null
  ) {
    originPoints = 20;
    originStatus = "strong";

    evidence.push({
      key: "origin-signal",
      label: "Origin-to-market export signal",
      value: `$${input.originExportValue.toLocaleString()}`,
      status: "strong",
      source: "UN Comtrade",
      note:
        input.originShare !== null
          ? `Origin share: ${input.originShare}%`
          : "Origin-specific bilateral trade value is recorded.",
    });
  } else if (input.originExportStatus === "no_record") {
    originPoints = 0;
    originStatus = "limited";

    limitations.push(
      "No bilateral origin record was returned; this must not be interpreted as zero exports."
    );
  } else if (
    input.originExportStatus === "unavailable" ||
    input.originExportStatus === "data_unavailable"
  ) {
    originPoints = 0;
    originStatus = "unavailable";

    limitations.push(
      "Origin-specific data was unavailable for this market."
    );
  } else {
    limitations.push("Origin-specific evidence was not requested.");
  }

  // 5. Coverage — 10 points.
  // This represents whether the core current + historical evidence needed
  // for the intelligence layer is actually present.
  let coveragePoints = 0;

  if (input.importValue > 0) coveragePoints += 5;
  if (growthAvailable) coveragePoints += 5;

  const coverageStatus = statusFromPoints(coveragePoints, 10);

  if (coveragePoints < 10) {
    limitations.push(
      "The evidence set does not contain the full current-plus-history coverage."
    );
  }

  const evidenceBreakdown: EvidenceBreakdown = {
    demand: {
      points: demandPoints,
      maxPoints: 25,
      status: demandStatus,
      source: "UN Comtrade",
      note:
        demandPoints > 0
          ? "Current destination import value is available."
          : "No positive destination import value is available.",
    },

    growth: {
      points: growthPoints,
      maxPoints: 25,
      status: growthStatus,
      source: "UN Comtrade",
      note: growthAvailable
        ? "Current and previous-year import values support a year-over-year calculation."
        : "Previous-year evidence is insufficient for a reliable growth calculation.",
    },

    dataQuality: {
      points: dataQualityPoints,
      maxPoints: 20,
      status: dataQualityStatus,
      source: "UN Comtrade",
      note: dataQualityNote,
    },

    origin: {
      points: originPoints,
      maxPoints: 20,
      status: originStatus,
      source: "UN Comtrade",
      note:
        input.originExportStatus === "recorded"
          ? "Origin-specific bilateral trade is recorded."
          : input.originExportStatus === "no_record"
            ? "No bilateral record was returned; this is not treated as zero exports."
            : input.originExportStatus === "unavailable" ||
                input.originExportStatus === "data_unavailable"
              ? "Origin-specific evidence could not be established."
              : "Origin-specific evidence was not requested.",
    },

    coverage: {
      points: coveragePoints,
      maxPoints: 10,
      status: coverageStatus,
      source: "UN Comtrade",
      note:
        coveragePoints === 10
          ? "Current and previous-year trade evidence are available."
          : "Historical coverage is incomplete.",
    },
  };

  let evidenceScore =
    demandPoints +
    growthPoints +
    dataQualityPoints +
    originPoints +
    coveragePoints;

  /*
   * Missing origin evidence must never look equivalent to validated
   * origin-market fit.
   *
   * no_record = evidence lookup succeeded but no bilateral row was found.
   * unavailable/data_unavailable = evidence could not be established.
   */
  if (
    input.originExportStatus === "unavailable" ||
    input.originExportStatus === "data_unavailable"
  ) {
    evidenceScore = Math.min(evidenceScore, 59);
  } else if (input.originExportStatus === "no_record") {
    evidenceScore = Math.min(evidenceScore, 69);
  }

  evidenceScore = clamp(Math.round(evidenceScore));

  const signal = decisionSignal(
    input.demandScore,
    input.growthRate,
    evidenceScore
  );

  const marketPriority: MarketPriority =
    signal === "promising" && evidenceScore >= 70
      ? "priority"
      : signal === "watch" && evidenceScore >= 50
        ? "monitor"
        : "research";

  const evidenceLabel =
    evidenceScore >= 75
      ? "High"
      : evidenceScore >= 50
        ? "Medium"
        : "Low";

  const evidenceStatus: EvidenceStatus =
    evidenceScore >= 75
      ? "strong"
      : evidenceScore >= 50
        ? "moderate"
        : evidenceScore > 0
          ? "limited"
          : "unavailable";

  const decisionLabel =
    signal === "promising"
      ? "Promising market signal"
      : signal === "watch"
        ? "Worth monitoring"
        : "Insufficient evidence";

  const nextAction =
    signal === "insufficient-evidence"
      ? "Collect stronger market evidence before prioritizing outreach."
      : input.originExportStatus === "unavailable" ||
          input.originExportStatus === "data_unavailable"
        ? "Verify buyer access and origin-specific trade evidence."
        : input.originExportStatus === "no_record"
          ? "Verify whether the missing origin record reflects coverage or a real gap."
          : signal === "promising"
            ? "Validate buyers and market access before outreach."
            : "Monitor demand and validate buyers before prioritizing outreach.";

  return {
    marketPriority,
    evidenceScore,
    evidenceLabel,
    evidenceStatus,
    evidenceBreakdown,
    decisionSignal: signal,
    decisionLabel,
    nextAction,
    evidence,
    limitations,
  };
}
