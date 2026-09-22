export type DataTruthStatus =
  | "reported"
  | "estimated"
  | "no_record"
  | "unavailable";

export type EvidenceStrength =
  | "strong"
  | "moderate"
  | "limited"
  | "unavailable";

export function normalizeDataTruth(input: {
  isEstimated?: boolean;
  hasRecord?: boolean;
  available?: boolean;
}): DataTruthStatus {
  if (input.available === false) {
    return "unavailable";
  }

  if (input.hasRecord === false) {
    return "no_record";
  }

  if (input.isEstimated === true) {
    return "estimated";
  }

  return "reported";
}

export function evidenceStrengthFromScore(
  score: number | null | undefined
): EvidenceStrength {
  if (score == null || Number.isNaN(score)) {
    return "unavailable";
  }

  if (score >= 75) {
    return "strong";
  }

  if (score >= 50) {
    return "moderate";
  }

  if (score > 0) {
    return "limited";
  }

  return "unavailable";
}
