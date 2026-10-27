import type { BuyerRecord } from "./types";

export type BuyerExecutionPriority = "high" | "medium" | "low" | "hold";

export type BuyerExecution = {
  priority: BuyerExecutionPriority;
  evidenceSignal: "strong" | "moderate" | "limited";
  verificationSignal:
    | "recent-activity"
    | "shipment-match"
    | "identity-only"
    | "missing";
  outreachReady: false;
  blockers: string[];
  nextAction: string;
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].slice(0, 8);
}

export function buildBuyerExecution(buyer: BuyerRecord): BuyerExecution {
  const blockers: string[] = [];
  const matching = typeof buyer.matchingShipments === "number" && buyer.matchingShipments > 0;
  const activity = typeof buyer.shipmentCount === "number" && buyer.shipmentCount > 0;
  const recent = Boolean(buyer.lastShipmentDate?.trim());
  const relevance = typeof buyer.relevanceScore === "number" ? buyer.relevanceScore : null;

  if (!matching) blockers.push("No product-matched shipment count was provided.");
  if (!activity) blockers.push("No shipment activity signal was provided.");
  if (!recent) blockers.push("Recent shipment date was not provided by the source.");
  if (buyer.evidenceStatus !== "strong") blockers.push("Buyer evidence is not classified as strong.");

  let verificationSignal: BuyerExecution["verificationSignal"] = "missing";
  if (recent && matching) verificationSignal = "recent-activity";
  else if (matching) verificationSignal = "shipment-match";
  else if (buyer.companyName.trim() && buyer.companyLink) verificationSignal = "identity-only";

  let priority: BuyerExecutionPriority = "hold";
  if (buyer.evidenceStatus === "strong" && matching && recent && relevance !== null && relevance >= 80) priority = "high";
  else if ((matching || activity) && (relevance === null || relevance >= 60)) priority = "medium";
  else if (activity || relevance !== null) priority = "low";

  const nextAction =
    priority === "high"
      ? "Manually verify company identity and decision-maker before outreach."
      : priority === "medium"
        ? "Close recency, identity, and contact gaps before outreach."
        : priority === "low"
          ? "Collect stronger product-specific buyer evidence."
          : "Do not prioritize this buyer until stronger evidence is available.";

  return {
    priority,
    evidenceSignal:
      buyer.evidenceStatus === "strong"
        ? "strong"
        : buyer.evidenceStatus === "moderate"
          ? "moderate"
          : "limited",
    verificationSignal,
    outreachReady: false,
    blockers: unique(blockers),
    nextAction,
  };
}
