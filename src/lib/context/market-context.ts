export type ContextStatus =
  | "supported"
  | "limited"
  | "unavailable"
  | "not-checked";

export type CompetitionContext = {
  status: ContextStatus;
  supplierCount: number | null;
  concentration: "high" | "medium" | "low" | "unknown";
  originPosition:
    | "established"
    | "emerging"
    | "not-established"
    | "unknown";
  signals: string[];
  limitations: string[];
};

export type MarketAccessContext = {
  status: ContextStatus;
  tariff: {
    status: ContextStatus;
    rate: number | null;
  };
  preferentialRate: {
    status: ContextStatus;
    rate: number | null;
  };
  tradeRemedy: ContextStatus;
  nonTariffMeasures: ContextStatus;
  signals: string[];
  limitations: string[];
};

export type MarketContext = {
  competition: CompetitionContext;
  marketAccess: MarketAccessContext;
};

export function buildCompetitionContext(input: {
  originStatus: string | null;
  originShare: number | null;
  supplierCount?: number | null;
}): CompetitionContext {
  const supplierCount =
    typeof input.supplierCount === "number"
      ? input.supplierCount
      : null;

  const signals: string[] = [];
  const limitations: string[] = [];

  if (supplierCount !== null) {
    const concentration =
      supplierCount <= 3
        ? "high"
        : supplierCount <= 8
          ? "medium"
          : "low";

    signals.push(
      `${supplierCount} supplier markets are represented in the current competitive view.`,
    );

    return {
      status: "limited",
      supplierCount,
      concentration,
      originPosition:
        input.originStatus === "recorded" && (input.originShare ?? 0) > 0
          ? "established"
          : input.originStatus === "recorded"
            ? "emerging"
            : "not-established",
      signals,
      limitations,
    };
  }

  limitations.push(
    "Supplier-country competition has not been directly measured yet.",
  );

  if (input.originStatus === "recorded") {
    signals.push(
      "Origin-specific trade evidence exists, but relative supplier position is not yet established.",
    );
  } else {
    signals.push(
      "The selected origin does not yet have established competitive-position evidence.",
    );
  }

  return {
    status: "unavailable",
    supplierCount: null,
    concentration: "unknown",
    originPosition:
      input.originStatus === "recorded"
        ? "emerging"
        : "not-established",
    signals,
    limitations,
  };
}

export function buildMarketAccessContext(): MarketAccessContext {
  return {
    status: "not-checked",
    tariff: {
      status: "not-checked",
      rate: null,
    },
    preferentialRate: {
      status: "not-checked",
      rate: null,
    },
    tradeRemedy: "not-checked",
    nonTariffMeasures: "not-checked",
    signals: [],
    limitations: [
      "Tariff evidence has not been connected yet.",
      "Preferential treatment has not been verified.",
      "Trade remedies have not been verified.",
      "Non-tariff measures have not been verified.",
    ],
  };
}
