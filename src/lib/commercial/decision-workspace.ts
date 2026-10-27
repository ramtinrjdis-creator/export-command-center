import type { CommercialDecision } from "./commercial-decision";
import type {
  CommercialCapability,
  CommercialPlan,
} from "./plan-policy";

export type EvidenceLayerStatus =
  | "strong"
  | "moderate"
  | "limited"
  | "unavailable"
  | "not-checked";

export type DecisionWorkspaceInput = {
  plan: CommercialPlan;
  decision: CommercialDecision;
  evidence: {
    market: EvidenceLayerStatus;
    origin: EvidenceLayerStatus;
    competition: EvidenceLayerStatus;
    buyers: EvidenceLayerStatus;
    marketAccess: EvidenceLayerStatus;
  };
};

export type DecisionWorkspace = {
  plan: CommercialPlan;
  primarySignal: CommercialDecision["signal"];
  headline: string;
  score: number;
  confidence: CommercialDecision["confidence"];
  capabilitiesUnlocked: CommercialCapability[];
  blockers: string[];
  evidenceGaps: string[];
  counterSignals: string[];
  nextAction: string;
  nextResearch: string[];
  upgradeReasons: string[];
};

const layerLabels: Record<keyof DecisionWorkspaceInput["evidence"], string> = {
  market: "Market demand evidence",
  origin: "Origin-fit evidence",
  competition: "Competition evidence",
  buyers: "Buyer evidence",
  marketAccess: "Market-access evidence",
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].slice(0, 8);
}

export function buildDecisionWorkspace(
  input: DecisionWorkspaceInput,
): DecisionWorkspace {
  const upgradeReasons: string[] = [];

  if (input.plan === "free") {
    upgradeReasons.push(
      "Buyer-level verification and decision-pack generation are Pro capabilities.",
    );
  }

  const missingLayers = (
    Object.entries(input.evidence) as Array<
      [keyof DecisionWorkspaceInput["evidence"], EvidenceLayerStatus]
    >
  )
    .filter(([, status]) =>
      status === "unavailable" ||
      status === "not-checked",
    )
    .map(([layer]) => layerLabels[layer]);

  const nextResearch = unique([
    ...input.decision.evidenceGaps,
    ...missingLayers.map(
      (label) => `Validate ${label.toLowerCase()}.`,
    ),
  ]);

  const capabilitiesUnlocked: CommercialCapability[] =
    input.plan === "free"
      ? [
          "market_scan",
          "supplier_landscape",
          "decision_workspace",
        ]
      : [
          "market_scan",
          "deep_analysis",
          "buyer_intelligence",
          "supplier_landscape",
          "decision_workspace",
          "decision_pack",
          "saved_workspace",
        ];

  return {
    plan: input.plan,
    primarySignal: input.decision.signal,
    headline: input.decision.label,
    score: input.decision.score,
    confidence: input.decision.confidence,
    capabilitiesUnlocked,
    blockers: unique(input.decision.blockers),
    evidenceGaps: unique(input.decision.evidenceGaps),
    counterSignals: unique(input.decision.counterSignals),
    nextAction: input.decision.nextAction,
    nextResearch,
    upgradeReasons: unique(upgradeReasons),
  };
}
