export type MarketScoreInput = {
  importValue: number;
  maxImportValue: number;
  growthRate: number | null;
  cagr3y: number | null;
  growthConsistency: number | null;
  originStatus: "recorded" | "no_record" | "unavailable" | "data_unavailable" | null;
  evidenceScore: number;
  macro?: {
    population: number | null;
    gdpPerCapita: number | null;
  } | null;
};

export type MarketScoreResult = {
  score: number;
  signal: "strong-validation-target" | "validation-target" | "monitor" | "insufficient-evidence";
  demandScore: number;
  growthScore: number;
  historyScore: number;
  originScore: number;
  rationale: string;
  riskFlags: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizeGrowth(value: number | null) {
  if (value === null || Number.isNaN(value)) return 50;
  return clamp(50 + value * 2.2);
}

function normalizeCagr(value: number | null) {
  if (value === null || Number.isNaN(value)) return 50;
  return clamp(50 + value * 2.0);
}

export function scoreMarket(input: MarketScoreInput): MarketScoreResult {
  const demandScore =
    input.maxImportValue > 0
      ? clamp((Math.log10(Math.max(input.importValue, 1)) / Math.log10(Math.max(input.maxImportValue, 1))) * 100)
      : 0;

  const growthScore = normalizeGrowth(input.growthRate);
  const cagrScore = normalizeCagr(input.cagr3y);
  const consistencyScore =
    input.growthConsistency === null || Number.isNaN(input.growthConsistency)
      ? 50
      : clamp(input.growthConsistency * 100);

  const historyScore = Math.round(cagrScore * 0.65 + consistencyScore * 0.35);

  /*
   * Market Potential answers only:
   * "How attractive is the destination market itself?"
   *
   * Origin fit is deliberately kept out of this score.
   * A market can be highly attractive even when the selected
   * origin has no proven export history into it.
   */
  const originScore =
    input.originStatus === "recorded"
      ? 100
      : input.originStatus === "no_record"
        ? 35
        : 20;

  let score = Math.round(
    demandScore * 0.50 +
    growthScore * 0.25 +
    historyScore * 0.25
  );

  const riskFlags: string[] = [];

  if (input.growthRate !== null && input.growthRate < 0) {
    riskFlags.push("Negative recent growth");
  }

  if (input.cagr3y !== null && input.cagr3y < 0) {
    riskFlags.push("Negative 3-year trend");
  }

  if (input.growthConsistency !== null && input.growthConsistency < 0.5) {
    riskFlags.push("Uneven growth history");
  }

  if (
    input.originStatus === "unavailable" ||
    input.originStatus === "data_unavailable"
  ) {
    riskFlags.push("Origin evidence unavailable");
  } else if (input.originStatus === "no_record") {
    riskFlags.push("No bilateral origin record");
  }

  if (input.evidenceScore < 50) {
    riskFlags.push("Limited evidence coverage");
  }

  if (input.macro?.gdpPerCapita === null) {
    riskFlags.push("Macro context incomplete");
  }

  if (input.evidenceScore < 40) {
    score = Math.min(score, 59);
  }

  /*
   * A market-potential score is not the same as a validated export
   * opportunity. Strong validation requires positive origin evidence.
   */
  const positiveOriginEvidence =
    input.originStatus === "recorded";

  const signal =
    input.evidenceScore < 40
      ? "insufficient-evidence"
      : positiveOriginEvidence && score >= 75 && input.evidenceScore >= 70
        ? "strong-validation-target"
        : positiveOriginEvidence && score >= 60
          ? "validation-target"
          : score >= 60
            ? "monitor"
            : "monitor";

  const rationale =
    signal === "strong-validation-target"
      ? "Strong destination-market demand and momentum with positive origin evidence. Validate buyers and market access next."
      : signal === "validation-target"
        ? "The destination market has useful demand or growth signals and some origin evidence, but additional validation is needed."
        : input.originStatus !== "recorded" && score >= 60
          ? "The destination market shows useful potential, but origin-specific export fit is not yet proven."
          : signal === "monitor"
            ? "The market shows some signal, but its current evidence or momentum is not strong enough for immediate prioritization."
            : "Evidence coverage is too limited to support a stronger market decision yet.";

  return {
    score: clamp(score),
    signal,
    demandScore: Math.round(demandScore),
    growthScore: Math.round(growthScore),
    historyScore,
    originScore,
    rationale,
    riskFlags,
  };
}
