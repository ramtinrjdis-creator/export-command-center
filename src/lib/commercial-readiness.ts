export type CommercialStage = "market-screened" | "origin-validation" | "evidence-validation" | "buyer-validation" | "commercial-validation";
export type CommercialReadiness = { stage: CommercialStage; label: string; blockers: string[]; nextStep: string };
export type CommercialInput = {
  evidenceScore: number;
  originStatus?: string | null;
  buyerEvidenceEstablished?: boolean;
  marketAccessStatus?: "not-connected" | "verification-required" | "partially-verified";
};
export function buildCommercialReadiness(input: CommercialInput): CommercialReadiness {
  const blockers: string[] = [];
  if (input.originStatus !== "recorded") blockers.push("Origin-specific export fit is not confirmed.");
  if (input.evidenceScore < 70) blockers.push("Evidence coverage is below the stronger commercial-validation threshold.");
  if (!input.buyerEvidenceEstablished) blockers.push("Qualified buyer evidence is not established.");
  if (input.marketAccessStatus !== "partially-verified") blockers.push("Market-access requirements are not yet verified in this build.");
  let stage: CommercialStage = "commercial-validation";
  let label = "Commercial validation";
  let nextStep = "Combine buyer evidence, access conditions and competitive positioning into a go-to-market test.";
  if (input.originStatus !== "recorded") { stage = "origin-validation"; label = "Origin validation"; nextStep = "Resolve or deepen origin-specific evidence before spending heavily on buyer outreach."; }
  else if (input.evidenceScore < 70) { stage = "evidence-validation"; label = "Evidence validation"; nextStep = "Strengthen the core trade-evidence picture before treating the market as validated."; }
  else if (!input.buyerEvidenceEstablished) { stage = "buyer-validation"; label = "Buyer validation"; nextStep = "Move into qualified-buyer research and verify commercial relevance."; }
  else if (input.marketAccessStatus !== "partially-verified") { stage = "commercial-validation"; label = "Commercial validation"; nextStep = "Verify market-access conditions and commercial feasibility before scaling outreach."; }
  return { stage, label, blockers: blockers.slice(0, 4), nextStep };
}
