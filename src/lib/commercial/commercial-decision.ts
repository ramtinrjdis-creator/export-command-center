export type CommercialDecisionSignal =
  | "GO"
  | "VALIDATE"
  | "WATCH"
  | "DATA_GAP";

export type CommercialDecisionInput = {
  marketPotential: number | null;
  evidenceScore: number | null;
  originStatus: string | null;
  competitionStatus: string | null;
  buyerStatus: string | null;
  marketAccessStatus: string | null;
  growthRate: number | null;
};

export type CommercialDecision = {
  signal: CommercialDecisionSignal;
  score: number;
  label: string;
  confidence: "high" | "medium" | "low";
  blockers: string[];
  evidenceGaps: string[];
  counterSignals: string[];
  nextAction: string;
  rationale: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "").toLowerCase();
}

export function buildCommercialDecision(
  input: CommercialDecisionInput,
): CommercialDecision {
  const marketPotential =
    typeof input.marketPotential === "number" && Number.isFinite(input.marketPotential)
      ? clamp(input.marketPotential)
      : 0;
  const evidence =
    typeof input.evidenceScore === "number" && Number.isFinite(input.evidenceScore)
      ? clamp(input.evidenceScore)
      : 0;

  const origin = normalizeStatus(input.originStatus);
  const competition = normalizeStatus(input.competitionStatus);
  const buyers = normalizeStatus(input.buyerStatus);
  const access = normalizeStatus(input.marketAccessStatus);

  const blockers: string[] = [];
  const evidenceGaps: string[] = [];
  const counterSignals: string[] = [];

  const originSupported = origin === "recorded";
  const buyersSupported = buyers === "strong" || buyers === "supported";
  const accessVerified =
    access === "partially-verified" || access === "verified" || access === "supported";
  const competitionSupported =
    competition === "supported" || competition === "strong";

  if (!originSupported) {
    blockers.push("Origin-specific export fit is not fully established.");
    evidenceGaps.push(
      origin === "no_record"
        ? "No bilateral origin record was found; this is not proof of zero trade."
        : "Origin-specific evidence is unavailable or not yet checked.",
    );
  }

  if (evidence < 70) {
    blockers.push("Core trade evidence is below the stronger validation threshold.");
    evidenceGaps.push("Strengthen current-plus-history market evidence.");
  }

  if (!buyersSupported) {
    blockers.push("Qualified buyer evidence is not established.");
    evidenceGaps.push("Validate qualified buyers before significant outreach.");
  }

  if (!accessVerified) {
    blockers.push("Market-access conditions are not provider-verified.");
    evidenceGaps.push("Verify tariff, preference and regulatory conditions.");
  }

  if (!competitionSupported) {
    blockers.push("Supplier-side competitive position is not fully established.");
    evidenceGaps.push("Measure supplier position before final route-to-market commitment.");
  }

  if (input.growthRate !== null && Number.isFinite(input.growthRate) && input.growthRate < -10) {
    counterSignals.push(`Recent import demand is declining (${input.growthRate.toFixed(1)}%).`);
  }

  if (marketPotential < 50) {
    counterSignals.push("Market potential is below the stronger validation range.");
  }

  const score = clamp(
    marketPotential * 0.35 +
      evidence * 0.30 +
      (originSupported ? 15 : 0) +
      (buyersSupported ? 10 : 0) +
      (accessVerified ? 5 : 0) +
      (competitionSupported ? 5 : 0),
  );

  const confidence =
    evidence >= 80 && originSupported ? "high" : evidence >= 55 ? "medium" : "low";

  const allCommercialLayers =
    originSupported &&
    evidence >= 70 &&
    buyersSupported &&
    accessVerified &&
    competitionSupported;

  let signal: CommercialDecisionSignal;
  let label: string;
  let nextAction: string;
  let rationale: string;

  if (evidence === 0 || marketPotential === 0) {
    signal = "DATA_GAP";
    label = "Data gap";
    nextAction = "Resolve the missing core data before interpreting the market signal.";
    rationale = "The current evidence base is not sufficient to support a commercial direction.";
  } else if (allCommercialLayers && marketPotential >= 70 && input.growthRate !== null && input.growthRate >= 0) {
    signal = "GO";
    label = "Go to controlled validation";
    nextAction = "Run a controlled buyer outreach and market-entry validation test.";
    rationale = "The main commercial evidence layers are supported and the market signal is strong enough for a controlled test.";
  } else if (originSupported && evidence >= 70 && marketPotential >= 60) {
    signal = "VALIDATE";
    label = "Validate before commitment";
    nextAction = buyersSupported
      ? "Close market-access and competitive gaps before scaling outreach."
      : "Validate qualified buyers, then close market-access and competition gaps.";
    rationale = "Destination demand and origin fit are strong enough to justify deeper commercial validation, but the full evidence chain is not closed.";
  } else if (marketPotential >= 55 || evidence >= 60) {
    signal = "WATCH";
    label = "Watch / research";
    nextAction = !originSupported
      ? "Resolve origin-specific evidence before treating the destination as an export target."
      : "Strengthen evidence before allocating material commercial effort.";
    rationale = "There is a useful market signal, but the evidence chain is not yet strong enough for commercial commitment.";
  } else {
    signal = "DATA_GAP";
    label = "Evidence gap";
    nextAction = "Close the primary evidence gaps before further commercial action.";
    rationale = "Current evidence is too weak to justify a stronger decision.";
  }

  return {
    signal,
    score,
    label,
    confidence,
    blockers: [...new Set(blockers)].slice(0, 5),
    evidenceGaps: [...new Set(evidenceGaps)].slice(0, 5),
    counterSignals: counterSignals.slice(0, 4),
    nextAction,
    rationale,
  };
}
