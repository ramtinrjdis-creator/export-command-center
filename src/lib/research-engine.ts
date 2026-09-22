import {
  buildDecisionProfile,
  type DecisionMarket,
} from "./decision-engine";

export type ResearchPriority = "HIGH" | "MEDIUM" | "LOW";

export type ResearchTask = {
  id: string;
  title: string;
  why: string;
  action: string;
  priority: ResearchPriority;
  impact: number;
  uncertainty: number;
  cost: "Low" | "Medium";
};

export type ResearchMarket = DecisionMarket & {
  country?: string | null;
  countryName?: string | null;
  quantity?: number | null;
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function growthRate(market: ResearchMarket): number | null {
  return finite(market.yoyGrowth ?? market.growth);
}

function marketName(market: ResearchMarket): string {
  return market.countryName ?? market.country ?? "this market";
}

function addTask(tasks: ResearchTask[], task: ResearchTask): void {
  if (!tasks.some((item) => item.id === task.id)) {
    tasks.push(task);
  }
}

/**
 * Research Engine V6
 *
 * Decision Engine decides the current state.
 * Research Engine decides which uncertainty should be resolved next.
 *
 * The engine deliberately avoids generating a generic checklist for every
 * market. Buyer/access/competition research becomes relevant only after
 * the earlier decision gates are sufficiently resolved.
 */
export function buildNextBestResearch(
  market: ResearchMarket,
): ResearchTask[] {
  const tasks: ResearchTask[] = [];
  const decision = buildDecisionProfile(market);

  const evidence = finite(market.intelligence?.evidenceScore) ?? 0;
  const growth = growthRate(market);
  const origin = market.originExportStatus;
  const name = marketName(market);

  /*
   * 1. Hard decision gates.
   *
   * These always outrank downstream commercial research because the
   * downstream work has little value if the foundational evidence is
   * unresolved.
   */
  if (decision.decisionState === "resolve-data-gap") {
    addTask(tasks, {
      id: "resolve-origin-data-gap",
      title: "Resolve origin-data coverage",
      why:
        "The origin-specific dataset is unavailable, so the current market signal cannot yet establish export fit.",
      action:
        `Find an authoritative origin-specific trade source for ${name} before interpreting the missing signal as commercial evidence.`,
      priority: "HIGH",
      impact: 100,
      uncertainty: 98,
      cost: "Low",
    });
  }

  if (decision.decisionState === "validate-origin") {
    addTask(tasks, {
      id: "validate-origin",
      title: "Validate origin-specific trade activity",
      why:
        origin === "no_record"
          ? "No bilateral origin record was found. That is an evidence gap, not proof of zero trade."
          : "Origin fit is not yet established by the available trade evidence.",
      action:
        `Verify whether exports from the selected origin actually reach ${name} before spending effort on buyer outreach.`,
      priority: "HIGH",
      impact: 99,
      uncertainty: 95,
      cost: "Low",
    });
  }

  if (decision.decisionState === "strengthen-evidence") {
    addTask(tasks, {
      id: "strengthen-evidence",
      title: "Strengthen the evidence chain",
      why:
        "The market signal exists, but current evidence coverage is below the threshold for a stronger commercial decision.",
      action:
        "Cross-check the trade signal against another authoritative source and confirm period, reporter, partner, and product definition.",
      priority: "HIGH",
      impact: 96,
      uncertainty: 91,
      cost: "Low",
    });
  }

  /*
   * 2. Material counter-signals.
   *
   * These can change the thesis even when the formal decision state has
   * already advanced.
   */
  if (growth !== null && growth < 0) {
    addTask(tasks, {
      id: "investigate-decline",
      title: "Explain the demand decline",
      why:
        `The reported year-over-year signal is negative (${growth.toFixed(1)}%), which can materially change the opportunity thesis.`,
      action:
        "Determine whether the decline is structural, temporary, price-driven, or caused by a product-definition or data artifact.",
      priority: "HIGH",
      impact: 93,
      uncertainty: 88,
      cost: "Low",
    });
  } else if (growth !== null && growth >= 20) {
    addTask(tasks, {
      id: "verify-growth",
      title: "Verify the growth signal",
      why:
        `Growth is unusually strong (${growth.toFixed(1)}% YoY) and should be verified before treating it as durable demand.`,
      action:
        "Validate the growth across the prior period and another authoritative source, then separate price effects from underlying demand.",
      priority: "MEDIUM",
      impact: 82,
      uncertainty: 68,
      cost: "Low",
    });
  }

  if (market.isQuantityEstimated === true) {
    addTask(tasks, {
      id: "verify-quantity",
      title: "Verify physical demand volume",
      why:
        "The current quantity carries an estimation flag, so physical-demand interpretation has a confidence boundary.",
      action:
        "Verify net weight or quantity from a higher-quality source before using volume for pricing, capacity, or logistics decisions.",
      priority: "MEDIUM",
      impact: 76,
      uncertainty: 64,
      cost: "Low",
    });
  }

  /*
   * 3. Downstream commercial validation.
   *
   * Only expose these once the foundational evidence gates are sufficiently
   * resolved. This prevents the product from telling a user to find buyers
   * for a market whose origin fit is still unknown.
   */
  const foundationalStateResolved =
    decision.decisionState === "validate-buyers" ||
    (
      decision.decisionState === "validate-market-access" &&
      evidence >= 70
    );

  if (foundationalStateResolved) {
    addTask(tasks, {
      id: "validate-buyers",
      title: "Validate buyer route",
      why:
        "Market demand is not the same thing as a reachable commercial buyer.",
      action:
        `Find and verify importers, distributors, or recurring buyers relevant to ${name} and confirm they actually handle the target product.`,
      priority: "HIGH",
      impact: 91,
      uncertainty: 84,
      cost: "Medium",
    });

    addTask(tasks, {
      id: "validate-market-access",
      title: "Check market-access friction",
      why:
        "A strong demand signal can still fail commercially because of tariff, certification, registration, labeling, or regulatory constraints.",
      action:
        "Verify the actual import requirements for the product/origin pair before treating the market as commercially ready.",
      priority: "MEDIUM",
      impact: 87,
      uncertainty: 79,
      cost: "Low",
    });

    addTask(tasks, {
      id: "compare-origin-competition",
      title: "Compare competing origins",
      why:
        "A demand-heavy market is not automatically attractive if competing origins have stronger access, pricing, or supply continuity.",
      action:
        "Compare the selected origin with the main supplier origins on share, growth, access friction, and commercial positioning.",
      priority: "LOW",
      impact: 73,
      uncertainty: 70,
      cost: "Medium",
    });
  }

  /*
   * If the market has reached buyer validation, make market access explicit
   * as the next commercial constraint rather than hiding it behind a generic
   * checklist.
   */
  if (
    decision.decisionState === "validate-buyers" &&
    evidence >= 75 &&
    growth !== null &&
    growth >= 0
  ) {
    addTask(tasks, {
      id: "validate-market-access",
      title: "Validate market-access feasibility",
      why:
        "The core trade evidence is now strong enough that regulatory and import friction can determine whether buyer activity is commercially usable.",
      action:
        "Verify tariff, certification, registration, labeling, and origin-specific import requirements for the target product.",
      priority: "MEDIUM",
      impact: 89,
      uncertainty: 78,
      cost: "Low",
    });
  }

  /*
   * Decision-value ordering:
   *
   * impact × uncertainty / research cost
   *
   * The numeric score remains internal. The user sees only the task,
   * priority, reason, and concrete action.
   */
  const costPenalty: Record<ResearchTask["cost"], number> = {
    Low: 1,
    Medium: 1.18,
  };

  tasks.sort((a, b) => {
    const scoreA =
      (a.impact * a.uncertainty) / costPenalty[a.cost];
    const scoreB =
      (b.impact * b.uncertainty) / costPenalty[b.cost];

    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.impact - a.impact;
  });

  return tasks.slice(0, 4);
}
