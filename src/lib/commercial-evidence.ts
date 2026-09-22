export type CommercialEvidenceLayer =
  | "strong"
  | "moderate"
  | "limited"
  | "unavailable"
  | "not-checked";

export type CommercialEvidence = {
  status: "supported" | "partial" | "blocked";
  coverageScore: number;
  layers: {
    market: CommercialEvidenceLayer;
    origin: CommercialEvidenceLayer;
    competition: CommercialEvidenceLayer;
    buyers: CommercialEvidenceLayer;
    marketAccess: CommercialEvidenceLayer;
  };
  blockers: string[];
  nextDecision: string;
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function layerScore(layer: CommercialEvidenceLayer) {
  switch (layer) {
    case "strong":
      return 100;
    case "moderate":
      return 65;
    case "limited":
      return 35;
    default:
      return 0;
  }
}

export function buildCommercialEvidence(input: {
  evidenceScore: number;
  originStatus?: string | null;
  competitionStatus?: string | null;
  buyerStatus?: string | null;
  marketAccessStatus?: string | null;
}): CommercialEvidence {
  const marketScore = clampScore(input.evidenceScore);

  const market: CommercialEvidenceLayer =
    marketScore >= 75
      ? "strong"
      : marketScore >= 50
        ? "moderate"
        : marketScore > 0
          ? "limited"
          : "unavailable";

  const origin: CommercialEvidenceLayer =
    input.originStatus === "recorded"
      ? "strong"
      : input.originStatus === "no_record"
        ? "limited"
        : input.originStatus === "unavailable" ||
            input.originStatus === "data_unavailable"
          ? "unavailable"
          : "not-checked";

  const competition: CommercialEvidenceLayer =
    input.competitionStatus === "supported"
      ? "strong"
      : input.competitionStatus === "partial" ||
          input.competitionStatus === "limited"
        ? "moderate"
        : input.competitionStatus === "unavailable"
          ? "unavailable"
          : "not-checked";

  const buyers: CommercialEvidenceLayer =
    input.buyerStatus === "strong"
      ? "strong"
      : input.buyerStatus === "moderate"
        ? "moderate"
        : input.buyerStatus === "limited"
          ? "limited"
          : input.buyerStatus === "unavailable"
            ? "unavailable"
            : "not-checked";

  const marketAccess: CommercialEvidenceLayer =
    input.marketAccessStatus === "partially-verified"
      ? "moderate"
      : input.marketAccessStatus === "verification-required"
        ? "limited"
        : input.marketAccessStatus === "not-connected"
          ? "unavailable"
          : "not-checked";

  const layers = {
    market,
    origin,
    competition,
    buyers,
    marketAccess,
  };

  const coverageScore = clampScore(
    layerScore(market) * 0.35 +
      layerScore(origin) * 0.20 +
      layerScore(competition) * 0.15 +
      layerScore(buyers) * 0.20 +
      layerScore(marketAccess) * 0.10,
  );

  const blockers: string[] = [];

  if (marketScore < 70) {
    blockers.push(
      "Core market evidence is below the stronger validation threshold.",
    );
  }

  if (origin !== "strong") {
    blockers.push(
      "Origin-specific export fit is not fully established.",
    );
  }

  if (competition === "not-checked" || competition === "unavailable") {
    blockers.push(
      "Supplier-side competitive position is not established.",
    );
  }

  if (
    buyers === "not-checked" ||
    buyers === "unavailable" ||
    buyers === "limited"
  ) {
    blockers.push(
      "Qualified buyer evidence is not established.",
    );
  }

  if (marketAccess !== "moderate") {
    blockers.push(
      "Market-access conditions are not yet provider-verified.",
    );
  }

  const status: CommercialEvidence["status"] =
    blockers.length === 0
      ? "supported"
      : coverageScore >= 50
        ? "partial"
        : "blocked";

  let nextDecision =
    "Continue validation; the current evidence does not support a fully commercialized decision.";

  if (status === "supported") {
    nextDecision =
      "Move from evidence assembly into a controlled commercial validation test.";
  } else if (origin !== "strong") {
    nextDecision =
      "Resolve origin-specific evidence before treating destination demand as export fit.";
  } else if (
    buyers === "not-checked" ||
    buyers === "unavailable" ||
    buyers === "limited"
  ) {
    nextDecision =
      "Validate qualified buyers before committing significant outreach effort.";
  } else if (
    competition === "not-checked" ||
    competition === "unavailable"
  ) {
    nextDecision =
      "Measure supplier-side competition before forming a route-to-market hypothesis.";
  } else {
    nextDecision =
      "Verify market-access conditions and close the remaining commercial evidence gaps.";
  }

  return {
    status,
    coverageScore,
    layers,
    blockers: blockers.slice(0, 5),
    nextDecision,
  };
}
