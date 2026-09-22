export type CommercialDecision =
  | "advance"
  | "monitor"
  | "research"
  | "blocked";

export interface CommercialDecisionInput {
  evidenceScore: number | null;
  originSupported: boolean;
  buyerEvidenceEstablished: boolean;
  marketAccessVerified: boolean;
  dataAvailable: boolean;
}

export function deriveCommercialDecision(
  input: CommercialDecisionInput
): CommercialDecision {
  if (!input.dataAvailable) {
    return "blocked";
  }

  if (!input.originSupported) {
    return "monitor";
  }

  if (
    input.evidenceScore == null ||
    input.evidenceScore < 50
  ) {
    return "research";
  }

  if (
    input.evidenceScore >= 70 &&
    input.originSupported &&
    input.buyerEvidenceEstablished &&
    input.marketAccessVerified
  ) {
    return "advance";
  }

  return "research";
}
