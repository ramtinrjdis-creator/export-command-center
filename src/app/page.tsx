"use client";
import { buildMarketSnapshot, compareMarketSnapshots, readSavedMarketSnapshot, saveMarketSnapshot } from "@/lib/monitoring";
import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";

type EvidenceBreakdownItem = {
  points: number;
  maxPoints: number;
  status: string;
  source: string;
  note: string;
};

type Market = {
  market?: string;
  marketName?: string;
  country?: string;
  countryCode?: string | number;
  importValue?: number | null;
  importValueUsd?: number | null;
  tradeValue?: number | null;
  yoyGrowth?: number | null;
  growth?: number | null;
  demandScore?: number | null;
  score?: number | null;
  isReported?: boolean;
  isQuantityEstimated?: boolean;
  quantity?: number | null;
  quantityUnit?: string | null;
  originExportStatus?: string | null;
  originExportValue?: number | null;
  opportunity?: {
    score?: number | null;
    signal?: string | null;
    rationale?: string | null;
  } | null;
  decision?: {
    priority?: number;
    priorityLabel?: string;
    confidence?: number;
    confidenceLabel?: string;
    decisionState?: string;
    decisionThesis?: string;
    researchPriority?: string;
    nextAction?: string;
    unknowns?: string[];
    counterSignals?: string[];
    invalidationTriggers?: string[];
  } | null;
  researchPlan?: {
    id: string;
    title: string;
    why: string;
    action: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    impact: number;
    uncertainty: number;
    cost: "Low" | "Medium";
  }[];
  intelligence?: {
    decisionLabel?: string;
    decisionSignal?: string;
    evidenceLabel?: string;
    evidenceScore?: number | null;
    evidenceStatus?: string;
    nextAction?: string;
    limitations?: string[];
    evidenceBreakdown?: {
      demand?: EvidenceBreakdownItem;
      growth?: EvidenceBreakdownItem;
      dataQuality?: EvidenceBreakdownItem;
      origin?: EvidenceBreakdownItem;
      coverage?: EvidenceBreakdownItem;
    };
  } | null;
  evidence?: {
    demand?: string | boolean | null;
    growth?: string | boolean | null;
    origin?: string | boolean | null;
    buyer?: string | boolean | null;
  } | null;
  dataTrust?: {
    source?: string; period?: number; retrievedAt?: string; retrievalLabel?: string; truth?: string; coverage?: string; limitations?: string[];
  } | null;
  marketAccess?: {
    status?: string; provider?: string; coverage?: string; nextStep?: string; limitations?: string[];
  } | null;
  commercialReadiness?: {
    stage?: string; label?: string; blockers?: string[]; nextStep?: string;
  } | null;
  commercialEvidence?: {
    status?: "supported" | "partial" | "blocked";
    coverageScore?: number | null;
    layers?: {
      market?: string;
      origin?: string;
      competition?: string;
      buyers?: string;
      marketAccess?: string;
    };
    blockers?: string[];
    nextDecision?: string;
  } | null;
};

type SavedMarket = {
  market: Market;
  product: string;
  hsCode: string;
  originCode: string;
  year: string;
  savedAt: string;
};

type Buyer = {
  name?: string;
  company?: string;
  country?: string;
  source?: string;
  matchedShipments?: number | null;
  evidence?: string | null;
  url?: string | null;
  intelligence?: {
    signal?: string;
    label?: string;
    score?: number | null;
  } | null;
  verification?: {
    status?: string;
    label?: string;
  } | null;
  readiness?: "action-candidate" | "needs-verification" | "research" | null;
};

type AnalysisResponse = {
  ok?: boolean;
  error?: string;
  markets?: Market[];
  screening?: {
    methodology?: string;
    globalMarketsReturned?: number;
    screenedMarkets?: number;
    originQueries?: number;
    originDataAvailability?: string | null;
  };
};

type BuyerResearch = {
  mode?: string;
  market?: string;
  queries?: string[];
  links?: { label: string; url: string }[];
  note?: string;
};

type BuyerResponse = {
  ok?: boolean;
  available?: boolean;
  error?: string;
  buyers?: Buyer[];
  provider?: string | { mode?: string; configured?: boolean; source?: string };
  providerFallbackReason?: string | null;
  research?: BuyerResearch;
};

type SupplierRecord = {
  countryCode: number;
  country: string;
  importValue: number;
  share: number;
  rank: number;
};

type SupplierLandscape = {
  status?: "supported" | "partial" | "unavailable";
  destinationCode?: number;
  hsCode?: string;
  year?: number;
  totalImportValue?: number | null;
  suppliers?: SupplierRecord[];
  origin?: {
    status?: "recorded" | "no_record" | "not_checked" | "unavailable";
    countryCode?: number | null;
    importValue?: number | null;
    share?: number | null;
    rank?: number | null;
  };
  coverage?: {
    supplierCount?: number;
    representedValue?: number;
    representedShare?: number | null;
  };
  limitations?: string[];
};

type SupplierResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
  supplierLandscape?: SupplierLandscape;
};

type Country = { code: number; name: string; flag: string };

const COUNTRIES: Country[] = [
  [4, "Afghanistan", "🇦🇫"], [8, "Albania", "🇦🇱"], [12, "Algeria", "🇩🇿"],
  [32, "Argentina", "🇦🇷"], [36, "Australia", "🇦🇺"], [40, "Austria", "🇦🇹"],
  [31, "Azerbaijan", "🇦🇿"], [48, "Bahrain", "🇧🇭"], [50, "Bangladesh", "🇧🇩"],
  [56, "Belgium", "🇧🇪"], [76, "Brazil", "🇧🇷"], [124, "Canada", "🇨🇦"],
  [152, "Chile", "🇨🇱"], [156, "China", "🇨🇳"], [170, "Colombia", "🇨🇴"],
  [203, "Czechia", "🇨🇿"], [208, "Denmark", "🇩🇰"], [818, "Egypt", "🇪🇬"],
  [231, "Ethiopia", "🇪🇹"], [250, "France", "🇫🇷"], [268, "Georgia", "🇬🇪"],
  [276, "Germany", "🇩🇪"], [300, "Greece", "🇬🇷"], [356, "India", "🇮🇳"],
  [360, "Indonesia", "🇮🇩"], [364, "Iran", "🇮🇷"], [368, "Iraq", "🇮🇶"],
  [372, "Ireland", "🇮🇪"], [380, "Italy", "🇮🇹"], [392, "Japan", "🇯🇵"],
  [398, "Kazakhstan", "🇰🇿"], [404, "Kenya", "🇰🇪"], [414, "Kuwait", "🇰🇼"],
  [458, "Malaysia", "🇲🇾"], [484, "Mexico", "🇲🇽"], [504, "Morocco", "🇲🇦"],
  [528, "Netherlands", "🇳🇱"], [554, "New Zealand", "🇳🇿"], [566, "Nigeria", "🇳🇬"],
  [578, "Norway", "🇳🇴"], [512, "Oman", "🇴🇲"], [586, "Pakistan", "🇵🇰"],
  [608, "Philippines", "🇵🇭"], [616, "Poland", "🇵🇱"], [620, "Portugal", "🇵🇹"],
  [634, "Qatar", "🇶🇦"], [642, "Romania", "🇷🇴"], [643, "Russia", "🇷🇺"],
  [682, "Saudi Arabia", "🇸🇦"], [702, "Singapore", "🇸🇬"], [710, "South Africa", "🇿🇦"],
  [410, "South Korea", "🇰🇷"], [724, "Spain", "🇪🇸"], [752, "Sweden", "🇸🇪"],
  [756, "Switzerland", "🇨🇭"], [764, "Thailand", "🇹🇭"], [788, "Tunisia", "🇹🇳"],
  [792, "Türkiye", "🇹🇷"], [784, "United Arab Emirates", "🇦🇪"], [804, "Ukraine", "🇺🇦"],
  [826, "United Kingdom", "🇬🇧"], [842, "United States", "🇺🇸"], [860, "Uzbekistan", "🇺🇿"],
  [704, "Vietnam", "🇻🇳"],
].map(([code, name, flag]) => ({ code: Number(code), name: String(name), flag: String(flag) }));

const PRODUCT_PRESETS = [
  ["Coffee", "0901"], ["Pistachios / nuts", "0802"], ["Dates", "0804"],
  ["Raisins", "0806"], ["Saffron / spices", "0910"], ["Copper", "7403"],
  ["Aluminium", "7601"], ["Cement", "2523"], ["Ceramic tiles", "6907"], ["Steel", "72"],
].map(([name, hs]) => ({ name, hs }));

const YEARS = ["2025", "2024", "2023", "2022", "2021", "2020"];

function money(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value).toLocaleString()}`;
}

function num(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function pct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}


function nameOf(market: Market) {
  return market.marketName || market.market || market.country || "Unknown market";
}

function scoreOf(market: Market) {
  return market.decision?.priority ?? 0;
}

function toneFor(market: Market) {
  const signal = market.opportunity?.signal;
  if (signal === "strong-validation-target") return "emerald";
  if (signal === "validation-target") return "cyan";
  if (signal === "insufficient-evidence") return "amber";
  return "slate";
}

function labelFor(market: Market) {
  const base =
    market.intelligence?.decisionLabel ||
    (market.opportunity?.signal === "strong-validation-target" ? "Strong market signal" :
    market.opportunity?.signal === "validation-target" ? "Validation target" :
    market.opportunity?.signal === "insufficient-evidence" ? "Evidence gap" : "Monitor");

  if (base === "Promising market signal") {
    if (market.originExportStatus === "no_record") {
      return "Market signal · origin gap";
    }

    if (
      market.originExportStatus === "unavailable" ||
      market.originExportStatus === "data_unavailable"
    ) {
      return "Market signal · origin unverified";
    }
  }

  return base;
}



function marketBrief(market: Market) {
  const demand = Math.round(market.demandScore ?? 0);
  const growth = market.yoyGrowth ?? market.growth ?? null;
  const evidence = Math.round(
    market.intelligence?.evidenceScore ?? 0
  );

  const demandLabel =
    demand >= 90 ? "Very high relative demand" :
    demand >= 70 ? "High relative demand" :
    demand >= 40 ? "Moderate relative demand" :
    "Low relative demand";

  const momentumLabel =
    growth == null ? "Growth unavailable" :
    growth >= 10 ? "Strong momentum" :
    growth > 0 ? "Positive momentum" :
    "Weakening momentum";

  const evidenceLabel =
    evidence >= 75 ? "High evidence coverage" :
    evidence >= 50 ? "Moderate evidence coverage" :
    "Limited evidence coverage";

  const originLabel =
    market.originExportStatus === "recorded"
      ? "Origin signal recorded"
      : market.originExportStatus === "no_record"
        ? "No bilateral record returned"
        : "Origin evidence unavailable";

  const nextStep =
    market.originExportStatus === "recorded"
      ? "Validate buyers and market access next."
      : "Verify origin-specific trade coverage before outreach.";

  return {
    demandLabel,
    momentumLabel,
    evidenceLabel,
    originLabel,
    nextStep,
  };
}


function proPackFor(
  market: Market,
  comparisonMarkets: Market[] = []
) {
  const decision = market.decision ?? {
    priority: 0,
    priorityLabel: "Data gap",
    confidence: 0,
    confidenceLabel: "Low",
    decisionState: "resolve-data-gap",
    decisionThesis: "Decision data is unavailable.",
    researchPriority: "HIGH",
    nextAction: "Resolve the current evidence gap before commercial validation.",
    unknowns: [],
    counterSignals: [],
    invalidationTriggers: [],
  };

  const evidence = Math.max(
    0,
    Math.min(100, Math.round(market.intelligence?.evidenceScore ?? 0))
  );

  const marketName =
    market.country ||
    market.marketName ||
    market.market ||
    "Selected market";

  const originStatus =
    market.originExportStatus === "recorded"
      ? "Recorded"
      : market.originExportStatus === "no_record"
        ? "No bilateral record"
        : market.originExportStatus === "unavailable"
          ? "Unavailable"
          : "Not checked";

  const commercialState =
    market.originExportStatus === "recorded" &&
    evidence >= 70 &&
    (decision.confidence ?? 0) >= 75
      ? "Ready for buyer/access validation"
      : market.originExportStatus === "no_record"
        ? "Validate origin first"
        : evidence < 50
          ? "Evidence weak"
          : "Validation candidate";

  const commercialReason =
    commercialState === "Ready for buyer/access validation"
      ? "Core market and origin evidence are strong enough to move into buyer and market-access validation."
      : commercialState === "Validate origin first"
        ? "Destination demand is attractive, but origin-specific trade fit still needs confirmation."
        : commercialState === "Evidence weak"
          ? "The signal is not sufficiently evidenced for a confident commercial decision."
          : "The market signal is useful, but commercial validation is still incomplete.";

  const rankedComparison = comparisonMarkets
    .slice(0, 5)
    .map((item) => {
      const itemDecision = item.decision ?? {
    priority: 0,
    priorityLabel: "Data gap",
    confidence: 0,
    confidenceLabel: "Low",
    decisionState: "resolve-data-gap",
    decisionThesis: "Decision data is unavailable.",
    researchPriority: "HIGH",
    nextAction: "Resolve the current evidence gap before commercial validation.",
    unknowns: [],
    counterSignals: [],
    invalidationTriggers: [],
  };

      return {
        name:
          item.country ||
          item.marketName ||
          item.market ||
          "Market",
        priority: itemDecision.priority,
        confidence: itemDecision.confidence,
        origin:
          item.originExportStatus === "recorded"
            ? "Recorded"
            : item.originExportStatus === "no_record"
              ? "No record"
              : "Unavailable",
        growth: item.yoyGrowth ?? item.growth ?? null,
        importValue:
          item.importValue ??
          item.importValueUsd ??
          item.tradeValue ??
          null,
      };
    });

  const validationSteps = [
    decision.nextAction,
    "Identify and verify qualified importers, distributors, or commercial buyers.",
    "Verify tariff, certification, regulatory, and market-access requirements.",
    "Compare supplier-side commercial fit, competition, and route-to-market constraints.",
  ];

  return {
    marketName,
    priority: decision.priority,
    confidence: decision.confidence,
    confidenceLabel: decision.confidenceLabel,
    evidence,
    evidenceState:
      evidence >= 70
        ? "Strong enough for a deeper validation pass."
        : evidence >= 50
          ? "Usable signal, but important evidence gaps remain."
          : "Insufficient coverage for a confident commercial decision.",
    originStatus,
    commercialState,
    commercialReason,
    rankedComparison,
    unknowns: (decision.unknowns ?? []),
    counterSignals: (decision.counterSignals ?? []),
    validationSteps,
  };
}


function proDecisionTextFor(market: Market) {
  const pack = proPackFor(market);

  return [
    `Export Command Center — Pro Decision Pack`,
    `Market: ${pack.marketName}`,
    `Validation priority: ${pack.priority}/100`,
    `Confidence: ${pack.confidence}/100 (${pack.confidenceLabel})`,
    `Evidence coverage: ${pack.evidence}/100`,
    `Origin evidence: ${pack.originStatus}`,
    "",
    `Evidence assessment: ${pack.evidenceState}`,
    "",
    "Critical unknowns:",
    ...(pack.unknowns ?? []).map((item) => `- ${item}`),
    "",
    "Counter-signals:",
    ...((pack.counterSignals ?? []).length
      ? (pack.counterSignals ?? []).map((item) => `- ${item}`)
      : ["- None currently detected in the available evidence."]),
    "",
    "Validation sequence:",
    ...pack.validationSteps.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Evidence boundary: buyer/company records and market-access claims are not presented as verified until supported by a source/provider.",
  ].join("\n");
}

export default function Home() {
  const [proMode, setProMode] = useState(false);
  const [proCopied, setProCopied] = useState(false);
  const [proMarketIndex, setProMarketIndex] = useState(0);

const [product, setProduct] = useState("Coffee");
  const [hsCode, setHsCode] = useState("0901");
  const [originCode, setOriginCode] = useState("364");
  const [year, setYear] = useState("2025");
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [monitoringChange, setMonitoringChange] = useState<ReturnType<typeof compareMarketSnapshots> | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);

  const rankedMarkets = [...markets].sort(
    (a, b) => scoreOf(b) - scoreOf(a)
  );

  const [screening, setScreening] = useState<AnalysisResponse["screening"] | null>(null);

  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [workspaceCopied, setWorkspaceCopied] = useState(false);
  const [workspaceExported, setWorkspaceExported] = useState(false);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [buyerLoading, setBuyerLoading] = useState(false);
  const [buyerError, setBuyerError] = useState("");
  const [buyerProvider, setBuyerProvider] = useState<BuyerResponse["provider"] | null>(null);
  const [buyerFallbackReason, setBuyerFallbackReason] = useState<string | null>(null);
  const [buyerResearch, setBuyerResearch] = useState<BuyerResearch | null>(null);
  const [copied, setCopied] = useState(false);

  const [supplierLandscape, setSupplierLandscape] = useState<SupplierLandscape | null>(null);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierError, setSupplierError] = useState("");
  const [supplierMarketKey, setSupplierMarketKey] = useState("");

  const selectedCountry = COUNTRIES.find((c) => String(c.code) === originCode) || COUNTRIES.find((c) => c.code === 364)!;

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    return q
      ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || String(c.code).includes(q))
      : COUNTRIES;
  }, [countryQuery]);

  const selectedName = selectedMarket ? nameOf(selectedMarket) : "";
  const researchQuery = selectedMarket
    ? `"${product || "Product"}" importer buyer "${selectedName}" HS ${hsCode}`
    : "";
  const researchUrl = researchQuery
    ? `https://www.google.com/search?q=${encodeURIComponent(researchQuery)}`
    : "#";

  function marketKey(market: Market) {
    const code = String(market.countryCode ?? "").trim();

    return code
      ? `country:${code}`
      : `market:${nameOf(market).trim().toLowerCase()}`;
  }

  function focusWorkspace(market: Market) {
    const targetKey = marketKey(market);

    const index = rankedMarkets.findIndex(
      (item) => marketKey(item) === targetKey,
    );

    setSelectedMarket(market);
    setProMarketIndex(index >= 0 ? index : 0);

    window.setTimeout(() => {
      document.getElementById("decision-workspace")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 40);
  }

  const savedMarketsRaw = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};

      const notify = () => callback();
      window.addEventListener("storage", notify);
      window.addEventListener("ecc:saved-markets-change", notify);

      return () => {
        window.removeEventListener("storage", notify);
        window.removeEventListener("ecc:saved-markets-change", notify);
      };
    },
    () => {
      try {
        return window.localStorage.getItem("ecc:saved-markets:v2") || "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );

  const savedMarkets = useMemo<SavedMarket[]>(() => {
    try {
      const parsed = JSON.parse(savedMarketsRaw);

      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(
          (item): item is SavedMarket =>
            Boolean(
              item &&
              typeof item === "object" &&
              item.market &&
              typeof item.product === "string" &&
              typeof item.hsCode === "string" &&
              typeof item.originCode === "string" &&
              typeof item.year === "string",
            ),
        )
        .slice(0, 12);
    } catch {
      return [];
    }
  }, [savedMarketsRaw]);

  function toggleSavedMarket(market: Market) {
    const key = marketKey(market);

    const exists = savedMarkets.some(
      (item) => marketKey(item.market) === key,
    );

    const next = exists
      ? savedMarkets.filter((item) => marketKey(item.market) !== key)
      : [
          {
            market,
            product,
            hsCode,
            originCode,
            year,
            savedAt: new Date().toISOString(),
          },
          ...savedMarkets,
        ].slice(0, 12);

    try {
      window.localStorage.setItem(
        "ecc:saved-markets:v2",
        JSON.stringify(next),
      );
      window.dispatchEvent(new Event("ecc:saved-markets-change"));
    } catch {}
  }

  function openSavedMarket(saved: SavedMarket) {
    setProduct(saved.product);
    setHsCode(saved.hsCode);
    setOriginCode(saved.originCode);
    setYear(saved.year);
    focusWorkspace(saved.market);
  }

  async function copyResearchPlan() {
    if (!selectedMarket) return;

    const tasks = selectedMarket.researchPlan ?? [];

    const planText = [
      "Export Command Center — Research Plan",
      `Market: ${nameOf(selectedMarket)}`,
      `Product: ${product || "Product"}`,
      `HS Code: ${hsCode}`,
      `Origin: ${selectedCountry.name}`,
      `Trade year: ${year}`,
      "",
      ...tasks.map(
        (task, index) =>
          `${index + 1}. ${task.title} [${task.priority}] — ${task.action}`,
      ),
    ].join("\n");

    try {
      await navigator.clipboard?.writeText(planText);
      setWorkspaceCopied(true);
      window.setTimeout(() => setWorkspaceCopied(false), 1600);
    } catch {}
  }

  function exportSelectedMarket() {
    if (!selectedMarket) return;

    const payload = {
      exportedAt: new Date().toISOString(),
      product,
      hsCode,
      origin: {
        name: selectedCountry.name,
        code: originCode,
      },
      year,
      market: selectedMarket,
      researchPlan: selectedMarket.researchPlan ?? [],
    };

    try {
      const blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: "application/json" },
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download =
        `ecc-${nameOf(selectedMarket)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "market"}-decision.json`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      setWorkspaceExported(true);
      window.setTimeout(() => setWorkspaceExported(false), 1600);
    } catch {}
  }

  async function scan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanHs = hsCode.replace(/\D/g, "").slice(0, 6);
    if (!/^\d{2,6}$/.test(cleanHs)) {
      setError("Choose a product or enter a valid 2–6 digit HS code.");
      return;
    }

    setLoading(true);
    setError("");
    setSearched(false);
    setMarkets([]);
    setScreening(null);
    setSelectedMarket(null);
    setProMarketIndex(0);
    setBuyers([]);
    setBuyerError("");
    setBuyerResearch(null);
    setSupplierLandscape(null);
    setSupplierError("");
    setSupplierMarketKey("");

    try {
      const params = new URLSearchParams({ hsCode: cleanHs, year, origin: originCode });
      const response = await fetch(`/api/analyze?${params.toString()}`);
      const data = (await response.json()) as AnalysisResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Market scan failed.");
      const nextMarkets = data.markets ?? [];
      const rankedNextMarkets = [...nextMarkets].sort(
        (a, b) => scoreOf(b) - scoreOf(a),
      );

      setMarkets(nextMarkets);
      setSelectedMarket(rankedNextMarkets[0] ?? null);
      setProMarketIndex(0);

      const currentSnapshot = buildMarketSnapshot(nextMarkets, {
        product: product.trim(),
        hsCode: cleanHs,
        originCode,
        year,
      });
      const previousSnapshot = readSavedMarketSnapshot();
      setMonitoringChange(compareMarketSnapshots(previousSnapshot, currentSnapshot));
      saveMarketSnapshot(currentSnapshot);
      setScreening(data.screening ?? null);
      setSearched(true);
      window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Market scan failed.");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function investigate(market: Market) {
    setSelectedMarket(market);
    setBuyerLoading(true);
    setBuyerError("");
    setBuyers([]);
    setBuyerProvider(null);
    setBuyerFallbackReason(null);
    setBuyerResearch(null);
    try {
      const params = new URLSearchParams({
        hsCode,
        market: String(market.countryCode ?? ""),
        marketName: nameOf(market),
        productDescription: product,
        limit: "10",
      });
      const response = await fetch(`/api/buyers?${params.toString()}`);
      const data = (await response.json()) as BuyerResponse;
      if (!response.ok || data.ok === false) throw new Error(data.error || "Buyer research unavailable.");
      setBuyers(data.buyers ?? []);
      setBuyerProvider(data.provider ?? null);
      setBuyerFallbackReason(data.providerFallbackReason ?? null);
      setBuyerResearch(data.research ?? null);
      window.setTimeout(() => document.getElementById("buyers")?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (err) {
      setBuyerError(err instanceof Error ? err.message : "Buyer research unavailable.");
    } finally {
      setBuyerLoading(false);
    }
  }

  async function loadSupplierLandscape(market: Market) {
    const marketCode = Number(market.countryCode);

    if (!Number.isInteger(marketCode) || marketCode < 1) {
      setSupplierError("Supplier evidence requires a valid destination market.");
      return;
    }

    setSupplierLoading(true);
    setSupplierError("");
    setSupplierMarketKey(marketKey(market));

    try {
      const params = new URLSearchParams({
        hsCode,
        market: String(marketCode),
        marketName: nameOf(market),
        origin: originCode,
        year,
        limit: "12",
      });

      const response = await fetch(`/api/suppliers?${params.toString()}`);
      const data = (await response.json()) as SupplierResponse;

      if (!response.ok || data.ok === false) {
        const retryHint =
          data.retryAfterSeconds != null
            ? ` Retry in about ${data.retryAfterSeconds}s.`
            : "";
        throw new Error(
          `${data.error || "Supplier landscape unavailable."}${retryHint}`,
        );
      }

      if (!data.supplierLandscape) {
        throw new Error("Supplier landscape data was not returned.");
      }

      setSupplierLandscape(data.supplierLandscape);
    } catch (err) {
      setSupplierLandscape(null);
      setSupplierError(
        err instanceof Error
          ? err.message
          : "Supplier landscape unavailable.",
      );
    } finally {
      setSupplierLoading(false);
    }
  }

  async function copyQuery() {
    if (!researchQuery) return;

    try {
      await navigator.clipboard?.writeText(researchQuery);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  const focusMarket = selectedMarket ?? rankedMarkets[0] ?? null;
  const supplierLoadedForFocus =
    Boolean(focusMarket) &&
    Boolean(supplierLandscape) &&
    supplierMarketKey === marketKey(focusMarket as Market);

  const commercialEvidence =
    focusMarket?.commercialEvidence ?? null;

  const commercialCoverage =
    commercialEvidence?.coverageScore == null
      ? null
      : Math.round(commercialEvidence.coverageScore);

  const commercialBlockers =
    commercialEvidence?.blockers ?? [];

  const buyerLayerLabel =
    buyers.length > 0
      ? "Provider-backed results"
      : buyerResearch
        ? "Free research mode"
        : "Not checked";

  const supplierLayerLabel =
    supplierLoadedForFocus
      ? `${supplierLandscape?.suppliers?.length ?? 0} supplier markets`
      : "On-demand";

  const commercialNextDecision =
    commercialEvidence?.nextDecision ||
    focusMarket?.decision?.nextAction ||
    focusMarket?.commercialReadiness?.nextStep ||
    "Continue validation before commercial scaling.";

  const v7PlanLabel =
    proMode
      ? "Pro preview"
      : "Free research";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#05080d] text-white selection:bg-cyan-300/20 selection:text-cyan-100 ecc-v7">





      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,.1),transparent_30%),radial-gradient(circle_at_90%_12%,rgba(16,185,129,.075),transparent_26%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:52px_52px]" />

      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#05080d]/80 backdrop-blur-2xl ecc-v7-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <a href="#top" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-sm font-black text-cyan-200">EC</div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Export Command Center</div>
              <div className="text-[9px] uppercase tracking-[0.22em] text-white/28">Trade intelligence</div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-xs text-white/40 md:flex">
            <a href="#scanner" className="hover:text-white">Scanner</a>
            <a href="#market-results" className="hover:text-white">Markets</a>
            <a href="#buyers" className="hover:text-white">Buyers</a>
            <a href="#evidence" className="hover:text-white">Evidence</a>
          <a href="#decision-workspace" className="transition hover:text-white">Workspace</a>
          <a href="#pro" className="transition hover:text-white">Pro</a>
          </nav>

          <span className="rounded-full border border-white/9 bg-white/[0.025] px-3 py-1.5 text-[10px] text-white/35">Evidence-first mode</span>
        </div>
      </header>
      <div className="ecc-v7-command-rail-wrap pointer-events-none">
        <div className="ecc-v7-command-rail pointer-events-auto">
          <div className="ecc-v7-command-rail-inner" aria-label="Export intelligence workflow">
            <a className="ecc-v7-command-step" href="#top"><span>01</span><span>Scan</span></a>
            <a className="ecc-v7-command-step" href="#market-results"><span>02</span><span>Markets</span></a>
            <a className="ecc-v7-command-step" href="#evidence"><span>03</span><span>Evidence</span></a>
            <a className="ecc-v7-command-step" href="#decision-workspace"><span>04</span><span>Decision</span></a>
            <a className="ecc-v7-command-step" href="#buyers"><span>05</span><span>Buyers</span></a>
            <a className="ecc-v7-command-step" href="#pro"><span>06</span><span>Pro</span></a>
          </div>
        </div>
      </div>


      <section id="top" className="mx-auto max-w-7xl px-5 pb-12 pt-14 md:px-8 md:pb-20 md:pt-20 ecc-v7-hero">
        <div className="grid gap-10 lg:grid-cols-[1.03fr_.97fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Evidence-first export intelligence
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[.98] tracking-[-0.06em] md:text-7xl">Find where your product has demand before you spend time chasing buyers.</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/45 md:text-lg">Start with a product and an origin. We turn trade data into market signals, show the evidence behind them, and tell you what still needs validation.</p>
            <div className="mt-7 flex flex-wrap gap-2">
              {["Demand", "Growth", "Origin evidence", "Buyer research"].map((item) => (
                <span key={item} className="rounded-full border border-white/8 bg-white/[0.02] px-3 py-2 text-[10px] text-white/40">{item}</span>
              ))}
            </div>
          </div>

          <div id="scanner" className="rounded-[30px] border border-white/[0.09] bg-white/[0.035] p-4 shadow-2xl shadow-black/30 md:p-5">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">Market scanner</div>
                <div className="mt-1 text-base font-medium text-white/85">No trade jargon required.</div>
              </div>
              <span
                role="status"
                aria-live="polite"
                className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.15em] ${
                  loading
                    ? "border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-200/80"
                    : "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200/80"
                }`}
              >
                {loading ? "Analyzing" : "Ready"}
              </span>
            </div>

            <form onSubmit={scan} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">What are you exporting?</span>
                <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Coffee, saffron, pistachios..." className="w-full rounded-2xl border border-white/9 bg-black/20 px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-cyan-300/30" />
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRODUCT_PRESETS.slice(0, 7).map((preset) => (
                    <button key={preset.name} type="button" onClick={() => { setProduct(preset.name); setHsCode(preset.hs); }} className="rounded-full border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-white/40 hover:border-cyan-300/20 hover:text-cyan-100">{preset.name}</button>
                  ))}
                </div>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">Product classification</span>
                  <input value={hsCode} onChange={(e) => setHsCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="HS 0901" className="w-full rounded-2xl border border-white/9 bg-black/20 px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-cyan-300/30" />
                  <span className="mt-1.5 block text-[10px] text-white/20">Use a known HS code or a suggested preset above.</span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">Trade year</span>
                  <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-2xl border border-white/9 bg-black/20 px-4 py-3.5 text-sm text-white outline-none focus:border-cyan-300/30">
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
              </div>

              <div>
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">Export origin</span>
                <div className="relative">
                  <button type="button" onClick={() => setCountryOpen((open) => !open)} className="flex w-full items-center justify-between rounded-2xl border border-white/9 bg-black/20 px-4 py-3.5 text-left hover:border-white/15">
                    <span className="flex items-center gap-3"><span className="text-xl">{selectedCountry.flag}</span><span><span className="block text-sm text-white/85">{selectedCountry.name}</span><span className="mt-0.5 block text-[10px] text-white/20">Search and select any supported country</span></span></span>
                    <span className="text-white/30">{countryOpen ? "⌃" : "⌄"}</span>
                  </button>

                  {countryOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1118] p-2 shadow-2xl">
                      <input autoFocus value={countryQuery} onChange={(e) => setCountryQuery(e.target.value)} placeholder="Search country..." className="w-full rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/20 focus:border-cyan-300/30" />
                      <div className="mt-2 max-h-64 overflow-auto">
                        {filteredCountries.map((country) => (
                          <button key={country.code} type="button" onClick={() => { setOriginCode(String(country.code)); setCountryOpen(false); setCountryQuery(""); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/[0.05] ${country.code === selectedCountry.code ? "bg-cyan-300/[0.06] text-cyan-100" : "text-white/60"}`}>
                            <span className="text-lg">{country.flag}</span><span className="flex-1">{country.name}</span><span className="text-[9px] text-white/15">{country.code}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div><div className="text-[9px] uppercase tracking-[0.16em] text-white/20">Scan definition</div><div className="mt-1 text-xs text-white/45">{product || "Product"} · HS {hsCode || "—"} · {selectedCountry.name} · {year}</div></div>
                <button disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-[#061016] hover:bg-cyan-50 disabled:opacity-60">{loading ? "Analyzing..." : "Analyze markets ↗"}</button>
              </div>
            </form>
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </div>
        ) : null}
      </section>

      <section id="market-results" className="scroll-mt-24 border-y border-white/[0.07] bg-black/10">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/65">01 / Market intelligence</div><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Markets worth validating</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-white/38">A signal is a reason to investigate, not a promise of a sale.</p></div>
            {searched ? <span className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-white/50">{product} · HS {hsCode} · {selectedCountry.name}</span> : null}
          </div>

          {searched && screening ? (
            <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Markets returned" value={num(screening.globalMarketsReturned)} detail="Source response" />
              <Stat label="Candidates" value={num(screening.screenedMarkets ?? markets.length)} detail="Passed screen" />
              <Stat label="Origin checks" value={num(screening.originQueries)} detail="Bilateral checks" />
              <Stat
                label="Origin data"
                value={
                  screening.originDataAvailability === "checked" ||
                  screening.originDataAvailability === "available"
                    ? "Checked"
                    : screening.originDataAvailability === "partial"
                      ? "Partial"
                      : screening.originDataAvailability === "unavailable"
                        ? "Unavailable"
                        : screening.originDataAvailability === "not-requested"
                          ? "Not requested"
                          : "Unknown"
                }
                detail="Never inferred as zero"
              />
            </div>
          ) : null}

          {searched && !loading ? (
            <div
              className={`mt-7 rounded-2xl border px-4 py-3 ${
                error
                  ? "border-rose-300/10 bg-rose-300/[0.025]"
                  : markets.length
                    ? "border-cyan-300/10 bg-cyan-300/[0.02]"
                    : "border-amber-300/10 bg-amber-300/[0.025]"
              }`}
              aria-live="polite"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
                    Scan status
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {error
                      ? "The market scan did not complete successfully. Review the error above and retry."
                      : markets.length
                        ? `${markets.length} candidate markets loaded. The highest-scoring decision target is now your working focus.`
                        : "No usable market candidates were returned for this scan."}
                  </div>
                </div>

                {markets.length ? (
                  <div className="text-[10px] text-cyan-200/55">
                    Focus: {nameOf(rankedMarkets[0])}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {markets.length ? (
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {rankedMarkets.map((market, index) => {
                const tone = toneFor(market);
                const score = scoreOf(market);
                const growth = market.yoyGrowth ?? market.growth;
                return (
                  <article key={`${nameOf(market)}-${index}`} className="rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-5 md:p-6">
                    <div className="flex items-start justify-between gap-5"><div className="min-w-0"><Badge tone={tone}>{labelFor(market)}</Badge><h3 className="mt-4 truncate text-2xl font-semibold tracking-tight">{nameOf(market)}</h3><p className="mt-1 text-xs text-white/20">Market candidate #{String(index + 1).padStart(2, "0")}</p></div><div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-cyan-300/15 bg-cyan-300/[0.04]"><div className="text-center"><div className="text-xl font-semibold">{score}</div><div className="text-[8px] uppercase tracking-[0.18em] text-white/22">validation priority</div></div></div></div>

                    <div className="mt-6 grid grid-cols-3 gap-2"><Stat label="Import demand" value={money(market.importValue ?? market.importValueUsd ?? market.tradeValue)} /><Stat label="1Y growth" value={pct(growth)} /><Stat label="Relative demand" value={`${Math.round(market.demandScore ?? 0)}/100`} /></div>
                      {(() => {
                        const brief = marketBrief(market);

                        return (
                          <div className="mb-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.025] p-4">
                            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/55">
                              Market brief
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <div className="rounded-xl bg-white/[0.025] p-3">
                                <div className="text-[9px] uppercase tracking-[0.14em] text-white/25">Relative demand</div>
                                <div className="mt-1 text-xs text-white/70">{brief.demandLabel}</div>
                              </div>

                              <div className="rounded-xl bg-white/[0.025] p-3">
                                <div className="text-[9px] uppercase tracking-[0.14em] text-white/25">Momentum</div>
                                <div className="mt-1 text-xs text-white/70">{brief.momentumLabel}</div>
                              </div>

                              <div className="rounded-xl bg-white/[0.025] p-3">
                                <div className="text-[9px] uppercase tracking-[0.14em] text-white/25">Evidence</div>
                                <div className="mt-1 text-xs text-white/70">{brief.evidenceLabel}</div>
                              </div>

                              <div className="rounded-xl bg-white/[0.025] p-3">
                                <div className="text-[9px] uppercase tracking-[0.14em] text-white/25">Origin</div>
                                <div className="mt-1 text-xs text-white/70">{brief.originLabel}</div>
                              </div>
                            </div>

                            <div className="mt-3 border-t border-white/6 pt-3">
                              <div className="text-[9px] uppercase tracking-[0.14em] text-white/25">
                                Next validation step
                              </div>
                              <div className="mt-1 text-xs leading-5 text-white/60">
                                {brief.nextStep}
                              </div>
                            </div>
                          </div>
                        );
                      })()}


                    {(() => {
                        const decision = market.decision ?? {
                          priority: 0,
                          priorityLabel: "Data gap",
                          confidence: 0,
                          confidenceLabel: "Low",
                          decisionState: "resolve-data-gap",
                          decisionThesis: "Decision data is unavailable.",
                          researchPriority: "HIGH",
                          nextAction: "Resolve the current evidence gap before commercial validation.",
                          unknowns: [],
                          counterSignals: [],
                          invalidationTriggers: [],
                        };

                        return (
                          <details className="ecc-market-details"><summary>Decision details<span>View details</span></summary><div className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.025] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/55">
                                  Decision diagnostic
                                </div>
                                <div className="mt-1 text-xs text-white/30">
                                  Separating opportunity from certainty.
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Badge tone="cyan">
                                  Priority {decision.priority}
                                </Badge>
                                <Badge tone={
                                  decision.confidenceLabel === "High"
                                    ? "emerald"
                                    : decision.confidenceLabel === "Medium"
                                      ? "cyan"
                                      : "amber"
                                }>
                                  Confidence {decision.confidenceLabel}
                                </Badge>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div>
                                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                                  Critical unknowns
                                </div>
                                <div className="mt-2 space-y-1.5">
                                  {(decision.unknowns ?? []).map((item) => (
                                    <div key={item} className="flex gap-2 text-xs leading-5 text-white/45">
                                      <span className="text-amber-300/70">!</span>
                                      <span>{item}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                                  Counter-signals
                                </div>
                                <div className="mt-2 space-y-1.5">
                                  {(decision.counterSignals ?? []).length ? (
                                    (decision.counterSignals ?? []).map((item) => (
                                      <div key={item} className="flex gap-2 text-xs leading-5 text-white/45">
                                        <span className="text-rose-300/70">↘</span>
                                        <span>{item}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs leading-5 text-white/30">
                                      No strong negative signal found in the current dataset.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 border-t border-white/6 pt-3">
                              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                                Next best action
                              </div>
                              <div className="mt-1 text-xs leading-5 text-cyan-100/65">
                                {decision.nextAction}
                              </div>
                            </div>
                          </div></details>
                        );
                      })()}

                    <div className="mt-4 rounded-2xl border border-white/7 bg-black/15 p-4"><div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/20">Why it surfaced</div><p className="mt-2 text-sm leading-6 text-white/55">{market.opportunity?.rationale || market.intelligence?.nextAction || "The current data supports a closer validation pass."}</p></div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2"><Evidence label="Trade record" value={market.isReported === true ? "Reported" : market.isReported === false ? "Not reported" : "Not specified"} note={`Quantity ${market.quantity == null ? "Unavailable" : `${num(market.quantity)} ${market.quantityUnit || ""}${market.isQuantityEstimated ? " · estimated" : ""}`}`} /><Evidence label="Origin evidence" value={market.originExportStatus === "recorded" ? "Recorded" : market.originExportStatus === "no_record" ? "No bilateral record" : market.originExportStatus === "unavailable" ? "Unavailable" : "Not confirmed"} note="Missing data is not treated as zero trade." /></div>

                    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/6 pt-4 text-xs text-white/40"><Dot good={market.evidence?.demand !== false} label="Demand" /><Dot good={market.evidence?.growth !== false} label="Growth" /><Dot good={market.originExportStatus === "recorded"} label="Origin" /><Dot good={false} label="Buyer" /></div>

                    {market.intelligence?.evidenceBreakdown ? (
                      <details className="ecc-market-details mt-5 rounded-2xl border border-white/7 bg-black/15 p-4">
                        <summary className="cursor-pointer list-none">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
                                Evidence details
                              </div>
                              <div className="mt-1 text-xs text-white/35">
                                Why this evidence score has its current strength
                              </div>
                            </div>
                            <div className="shrink-0 text-sm font-semibold text-cyan-100/75">
                              {Math.round(market.intelligence.evidenceScore ?? 0)}/100
                            </div>
                          </div>
                        </summary>

                        <div className="mt-4 space-y-3">
                          {(
                            [
                              ["Demand evidence", market.intelligence.evidenceBreakdown.demand],
                              ["Growth evidence", market.intelligence.evidenceBreakdown.growth],
                              ["Data quality", market.intelligence.evidenceBreakdown.dataQuality],
                              ["Origin evidence", market.intelligence.evidenceBreakdown.origin],
                              ["Data coverage", market.intelligence.evidenceBreakdown.coverage],
                            ] as [string, EvidenceBreakdownItem | undefined][]
                          ).map(([label, item]) => {
                            if (!item) return null;

                            const percentage =
                              item.maxPoints > 0
                                ? Math.round((item.points / item.maxPoints) * 100)
                                : 0;

                            return (
                              <div
                                key={String(label)}
                                className="rounded-xl border border-white/6 bg-white/[0.018] p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs font-medium text-white/65">
                                    {label}
                                  </div>
                                  <div className="text-xs font-semibold text-white/55">
                                    {item.points}/{item.maxPoints}
                                  </div>
                                </div>

                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/6">
                                  <div
                                    className="h-full rounded-full bg-cyan-300/55"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/28">
                                  <span>{item.status}</span>
                                  <span>·</span>
                                  <span>{item.source}</span>
                                </div>

                                <p className="mt-1.5 text-[11px] leading-5 text-white/32">
                                  {item.note}
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        <p className="mt-4 border-t border-white/6 pt-3 text-[10px] leading-5 text-white/25">
                          Evidence Strength measures evidence coverage and confidence.
                          It does not measure market attractiveness.
                        </p>
                      </details>
                    ) : null}

                    <div className="mt-6 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => focusWorkspace(market)}
                        className="w-full rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.09]"
                        aria-label={`Open decision workspace for ${nameOf(market)}`}
                      >
                        Open decision workspace
                      </button>

                      <button
                        type="button"
                        onClick={() => investigate(market)}
                        className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#061016] transition hover:bg-cyan-50"
                        aria-label={`Investigate buyers for ${nameOf(market)}`}
                      >
                        Investigate buyers ↗
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : searched ? <div className="mt-8 rounded-[28px] border border-white/8 bg-white/[0.02] p-8 text-center"><div className="text-sm font-medium">No usable market candidates yet.</div><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/35">Try another year, a broader HS code, or a more specific product classification.</p></div> : <div className="mt-8 rounded-[28px] border border-dashed border-white/8 bg-white/[0.015] p-8 text-center text-sm text-white/30">Run a scan above to populate evidence-backed market candidates.</div>}

          {searched && markets.length ? <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded-[28px] border border-cyan-300/10 bg-cyan-300/[0.035] p-5 md:p-6"><div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">Decision engine</div><div className="mt-3 text-2xl font-semibold tracking-tight">Start validation with {nameOf(rankedMarkets[0])}.</div><p className="mt-3 max-w-2xl text-sm leading-7 text-white/45">{rankedMarkets[0].intelligence?.nextAction || "Validate buyer access and market-entry conditions before outreach."}</p><div className="mt-5 flex flex-wrap gap-2"><Badge tone="cyan">Relative demand {Math.round(rankedMarkets[0].demandScore ?? rankedMarkets[0].score ?? 0)}/100</Badge><Badge tone={rankedMarkets[0].intelligence?.evidenceStatus === "strong" ? "emerald" : "amber"}>{rankedMarkets[0].intelligence?.evidenceLabel || "Evidence"} evidence</Badge><Badge tone="slate">Source: UN Comtrade</Badge></div></div><div className="rounded-[28px] border border-white/8 bg-white/[0.02] p-5 md:p-6"><div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/20">What is still missing</div><div className="mt-4 space-y-2 text-sm text-white/45"><div className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Buyer/company evidence</div><div className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Market-access verification</div><div className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Supplier-side commercial fit</div></div></div></div> : null}

          {screening?.methodology ? <details className="mt-8 rounded-[28px] border border-white/8 bg-white/[0.02] p-5 md:p-6"><summary className="cursor-pointer list-none text-sm font-medium text-white/70">How the signal is built</summary><div className="mt-5 grid gap-4 md:grid-cols-3"><Method title="Relative demand" body="Compares this market’s import value with the other markets returned in the same scan. It is not an absolute demand probability or percentage." /><Method title="Growth" body="Year-over-year movement shows whether demand is expanding or contracting." /><Method title="Origin" body="Origin-specific evidence is checked separately; unavailable data is never treated as zero." /></div><p className="mt-5 border-t border-white/6 pt-4 text-xs leading-6 text-white/22">{screening.methodology}</p></details> : null}
        </div>
      </section>


      <section id="decision-workspace" className="scroll-mt-24 border-b border-white/[0.07]">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/65">
                Decision workspace
              </div>

              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">
                Research Plan
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/38">
                The system chooses the next research step by decision impact and uncertainty,
                instead of showing the same checklist for every market.
              </p>
            </div>

            {selectedMarket ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.16em] text-cyan-200/45">
                    Focus market
                  </div>
                  <div className="mt-1 text-sm font-medium text-white/80">
                    {selectedName}
                  </div>
                  <div className="mt-1 text-[10px] text-white/25">
                    Selected from market intelligence
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSavedMarket(selectedMarket)}
                    className={`rounded-xl border px-3 py-2 text-[10px] font-semibold transition ${
                      savedMarkets.some((item) => marketKey(item.market) === marketKey(selectedMarket))
                        ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200"
                        : "border-white/8 bg-white/[0.025] text-white/45 hover:bg-white/[0.05] hover:text-white/70"
                    }`}
                  >
                    {savedMarkets.some((item) => marketKey(item.market) === marketKey(selectedMarket))
                      ? "Saved ✓"
                      : "Save market"}
                  </button>

                  <button
                    type="button"
                    onClick={copyResearchPlan}
                    className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-[10px] font-semibold text-white/45 transition hover:bg-white/[0.05] hover:text-white/70"
                  >
                    {workspaceCopied ? "Copied ✓" : "Copy plan"}
                  </button>

                  <button
                    type="button"
                    onClick={exportSelectedMarket}
                    className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2 text-[10px] font-semibold text-cyan-100/75 transition hover:bg-cyan-300/[0.08]"
                  >
                    {workspaceExported ? "Exported ✓" : "Export JSON"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {savedMarkets.length ? (
            <div className="mt-4 rounded-2xl border border-white/7 bg-white/[0.018] p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
                    Saved research
                  </div>
                  <div className="mt-1 text-xs text-white/32">
                    Browser-local market snapshots you can reopen without rescanning.
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-white/18">
                  {savedMarkets.length}/12 saved
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                {savedMarkets.map((saved) => (
                  <div
                    key={`${marketKey(saved.market)}:${saved.savedAt}`}
                    className="flex flex-col gap-3 rounded-xl border border-white/7 bg-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => openSavedMarket(saved)}
                      className="min-w-0 text-left transition hover:text-white"
                    >
                      <div className="truncate text-sm font-medium text-white/70">
                        {nameOf(saved.market)}
                      </div>
                      <div className="mt-1 text-[10px] text-white/22">
                        {saved.product || "Product"} · HS {saved.hsCode} · {saved.year}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleSavedMarket(saved.market)}
                      className="shrink-0 self-start rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[10px] font-semibold text-white/35 transition hover:bg-white/[0.05] hover:text-white/60 sm:self-auto"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-[10px] leading-5 text-white/18">
                Saved research stays in this browser only. It is not server-synced.
              </div>
            </div>
          ) : null}

          {selectedMarket ? (
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-white/7 bg-white/[0.018] px-4 py-3 text-[10px] uppercase tracking-[0.13em] text-white/25">
              <span>
                Working set:{" "}
                <span className="text-white/55">{selectedName}</span>
              </span>

              <span>
                Saved locally:{" "}
                <span className="text-cyan-200/60">
                  {savedMarkets.length}
                </span>
              </span>

              <span>
                Research tasks:{" "}
                <span className="text-white/55">
                  {selectedMarket.researchPlan?.length ?? 0}
                </span>
              </span>

              <span className="text-white/15">
                Browser-only workspace
              </span>
            </div>
          ) : null}

          {!selectedMarket ? (
            <div className="mt-8 rounded-[28px] border border-dashed border-white/8 bg-white/[0.015] p-8 text-center">
              <div className="text-sm font-medium text-white/65">
                Select a market to generate its research sequence.
              </div>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/30">
                Research priorities become specific only after the system knows which market
                you are investigating.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-4">
              {(selectedMarket.researchPlan ?? []).map((task, index) => (
                <article
                  key={task.id}
                  className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-5 md:p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-xs font-semibold text-cyan-200">
                          {String(index + 1).padStart(2, "0")}
                        </div>

                        <h3 className="text-base font-medium text-white/85">
                          {task.title}
                        </h3>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${
                            task.priority === "HIGH"
                              ? "border-rose-300/15 bg-rose-300/[0.05] text-rose-200"
                              : task.priority === "MEDIUM"
                                ? "border-amber-300/15 bg-amber-300/[0.05] text-amber-200"
                                : "border-white/8 bg-white/[0.03] text-white/35"
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>

                      <p className="mt-4 max-w-3xl text-sm leading-7 text-white/40">
                        {task.why}
                      </p>

                      <div className="mt-4 rounded-2xl border border-white/7 bg-black/15 p-4">
                        <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/20">
                          Recommended action
                        </div>

                        <p className="mt-2 text-sm leading-7 text-white/65">
                          {task.action}
                        </p>
                      </div>
                    </div>

                    <div className="grid shrink-0 grid-cols-2 gap-2 lg:w-44">
                      <div className="rounded-2xl border border-white/7 bg-black/10 p-3 text-center">
                        <div className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                          Impact
                        </div>
                        <div className="mt-2 text-sm font-medium text-white/75">
                          {task.impact}/100
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/7 bg-black/10 p-3 text-center">
                        <div className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                          Research cost
                        </div>
                        <div className="mt-2 text-sm font-medium text-white/75">
                          {task.cost}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              <div className="grid gap-3 rounded-2xl border border-dashed border-white/8 bg-black/10 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="text-xs leading-6 text-white/28">
                  Decision rule: resolve the cheapest high-impact uncertainty first.
                  Do not escalate to outreach while a critical validation gap remains.
                </div>

                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("buyers")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                  className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 transition hover:bg-white/[0.05] hover:text-white/70"
                >
                  Continue to buyers ↘
                </button>
              </div>
            </div>
          )}
        </div>
      </section>




      {/* ECC_FINAL_INTELLIGENCE_V1 */}
      <section id="evidence" className="scroll-mt-24 border-y border-white/[0.06] bg-[#060b10]">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/65">03 / Trust & commercial readiness</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white md:text-4xl">What the current evidence can—and cannot—support.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/40">This layer keeps the market signal separate from the claims that still require origin, buyer and market-access verification.</p>
            </div>
            {focusMarket ? <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/35">Focus: {nameOf(focusMarket)}</div> : null}
          </div>

          {focusMarket ? (
            <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/55">Data trust</div>
                <div className="mt-3 text-lg font-semibold text-white">{focusMarket.dataTrust?.truth === "reported" ? "Reported trade signal" : focusMarket.dataTrust?.truth === "estimated" ? "Estimated signal" : focusMarket.dataTrust?.truth === "not-reported" ? "Non-reported record" : "Mixed / unresolved"}</div>
                <div className="mt-2 text-xs leading-5 text-white/35">{focusMarket.dataTrust?.source || "UN Comtrade"} · period {focusMarket.dataTrust?.period ?? "—"}</div>
                <div className="mt-4 rounded-2xl border border-white/7 bg-black/15 p-4 text-xs leading-5 text-white/45">{focusMarket.dataTrust?.retrievalLabel || "Retrieval metadata unavailable"}. Coverage: {focusMarket.dataTrust?.coverage || "unknown"}.</div>
                {focusMarket.dataTrust?.limitations?.length ? <div className="mt-4 space-y-2">{focusMarket.dataTrust.limitations.slice(0, 3).map((item: string) => <div key={item} className="text-xs leading-5 text-white/30">• {item}</div>)}</div> : null}
              </article>

              <article className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/55">Market access</div>
                <div className="mt-3 text-lg font-semibold text-white">{focusMarket.marketAccess?.status === "partially-verified" ? "Provider-backed verification" : "Verification required"}</div>
                <div className="mt-2 text-xs leading-5 text-white/35">{focusMarket.marketAccess?.provider || "No access provider connected"}</div>
                <div className="mt-4 rounded-2xl border border-amber-300/10 bg-amber-300/[0.025] p-4 text-xs leading-5 text-amber-100/55">{focusMarket.marketAccess?.coverage || "No market-access claim is asserted."}</div>
                <div className="mt-4 text-xs leading-5 text-white/40">Next: {focusMarket.marketAccess?.nextStep || "Verify tariffs, taxes, requirements and rules of origin."}</div>
              </article>

              <article className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/55">Commercial readiness</div>
                <div className="mt-3 text-lg font-semibold text-white">{focusMarket.commercialReadiness?.label || "Market validation"}</div>
                <div className="mt-2 text-xs leading-5 text-white/35">Stage: {focusMarket.commercialReadiness?.stage || "market-screened"}</div>
                <div className="mt-4 rounded-2xl border border-white/7 bg-black/15 p-4 text-xs leading-5 text-white/45">{focusMarket.commercialReadiness?.nextStep || "Continue validation before commercial scaling."}</div>
                {focusMarket.commercialReadiness?.blockers?.length ? <div className="mt-4 space-y-2">{focusMarket.commercialReadiness.blockers.slice(0, 3).map((item: string) => <div key={item} className="text-xs leading-5 text-white/30">• {item}</div>)}</div> : null}
              </article>

              <article className="rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/55">
                  Competitive landscape
                </div>
                <div className="mt-3 text-lg font-semibold text-white">
                  {supplierLoadedForFocus
                    ? `${supplierLandscape?.suppliers?.length ?? 0} supplier markets`
                    : "Not checked yet"}
                </div>
                <div className="mt-2 text-xs leading-5 text-white/35">
                  Destination supplier evidence loads on demand so a normal market scan does not create a burst of upstream requests.
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => focusMarket && void loadSupplierLandscape(focusMarket)}
                    disabled={!focusMarket || supplierLoading}
                    className="w-full rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-300/[0.1] disabled:opacity-40"
                  >
                    {supplierLoading
                      ? "Loading competition..."
                      : supplierLoadedForFocus
                        ? "Refresh competition evidence"
                        : "Load competition evidence"}
                  </button>
                </div>

                {supplierError ? (
                  <div
                    role="alert"
                    className="mt-3 rounded-xl border border-amber-300/10 bg-amber-300/[0.025] p-3 text-[10px] leading-5 text-amber-100/55"
                  >
                    {supplierError}
                  </div>
                ) : null}

                {supplierLoadedForFocus ? (
                  <>
                    <div className="mt-4 rounded-xl border border-white/7 bg-black/15 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[9px] uppercase tracking-[0.14em] text-white/22">
                          Origin position
                        </span>
                        <span className="text-[10px] font-semibold text-white/65">
                          {supplierLandscape?.origin?.status === "recorded"
                            ? `#${supplierLandscape.origin.rank ?? "—"} · ${supplierLandscape.origin.share != null ? `${supplierLandscape.origin.share.toFixed(1)}%` : "—"}`
                            : supplierLandscape?.origin?.status === "no_record"
                              ? "No supplier record"
                              : "Not established"}
                        </span>
                      </div>

                      <div className="mt-2 text-[10px] leading-5 text-white/30">
                        {supplierLandscape?.coverage?.representedShare != null
                          ? `Coverage represented: ${supplierLandscape.coverage.representedShare.toFixed(1)}% of reported destination imports.`
                          : "Destination import total was not available for share calculation."}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {(supplierLandscape?.suppliers ?? []).slice(0, 5).map((supplier) => (
                        <div
                          key={`${supplier.countryCode}-${supplier.rank}`}
                          className="flex items-center gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2.5"
                        >
                          <span className="w-6 text-[10px] text-white/20">
                            #{supplier.rank}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-white/65">
                            {supplier.country}
                          </span>
                          <span className="text-[10px] text-white/35">
                            {supplier.share.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>

                    {supplierLandscape?.limitations?.length ? (
                      <div className="mt-4 space-y-1.5">
                        {supplierLandscape.limitations.slice(0, 2).map((item) => (
                          <div key={item} className="text-[10px] leading-5 text-white/25">
                            · {item}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </article>
            </div>
          ) : (
            <div className="mt-8 rounded-[24px] border border-white/8 bg-white/[0.02] p-6 text-sm text-white/35">Run a market scan to populate the trust and commercial-readiness workspace.</div>
          )}

          <div className="mt-6 rounded-[24px] border border-cyan-300/10 bg-cyan-300/[0.02] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/55">Monitoring</div>
                <div className="mt-2 text-sm font-medium text-white/80">{monitoringChange?.hasBaseline ? (monitoringChange.changedMarkets.length || monitoringChange.newMarkets.length || monitoringChange.removedMarkets.length ? "Change detected since the previous scan." : "No material change detected since the previous scan.") : "Baseline will be created from your first completed scan."}</div>
                <div className="mt-1 text-xs leading-5 text-white/30">This zero-cost demo keeps the last scan locally in your browser; it does not claim server-side live monitoring.</div>
              </div>
              {monitoringChange?.hasBaseline ? <div className="text-xs text-white/45">{monitoringChange.changedMarkets.length} changed · {monitoringChange.newMarkets.length} new · {monitoringChange.removedMarkets.length} removed</div> : null}
            </div>
            {monitoringChange?.changedMarkets?.length ? <div className="mt-4 grid gap-2 md:grid-cols-3">{monitoringChange.changedMarkets.slice(0, 3).map((item: { name: string; importDeltaPct: number | null; growthDeltaPts: number | null; priorityDelta?: number | null }) => <div key={item.name} className="rounded-xl border border-white/7 bg-black/10 p-3 text-xs text-white/50"><span className="text-white/75">{item.name}</span>{item.importDeltaPct != null ? <span> · import {item.importDeltaPct > 0 ? "+" : ""}{item.importDeltaPct}%</span> : null}{item.growthDeltaPts != null ? <span> · growth {item.growthDeltaPts > 0 ? "+" : ""}{item.growthDeltaPts} pts</span> : null}</div>)}</div> : null}
          </div>
        </div>
      </section>

<section id="buyers" className="scroll-mt-24">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
          <div className="grid gap-8 lg:grid-cols-[.82fr_1.18fr]">
            <div><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/65">02 / Buyer intelligence</div><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">From market signal to buyer research.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-white/38">Buyer evidence is a separate layer. Free mode keeps discovery and verification distinct without inventing company records.</p>{selectedMarket ? <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="text-[9px] uppercase tracking-[0.16em] text-white/20">Selected market</div><div className="mt-2 text-sm text-white/75">{selectedName}</div><div className="mt-1 text-xs text-white/25">{product} · HS {hsCode}</div></div> : null}</div>

            <div className="rounded-[28px] border border-white/8 bg-white/[0.02] p-5 md:p-6"><div className="flex items-center justify-between gap-4"><div><div className="text-sm font-medium text-white/85">Research workflow</div><div className="mt-1 text-xs text-white/25">Find → Verify → Record</div></div><span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-white/25">No fake buyers</span></div>

              <div className="mt-5 rounded-2xl border border-white/7 bg-black/15 p-4"><div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/20">Targeted research query</div><div className="mt-2 break-words text-sm leading-6 text-white/55">{researchQuery || "Select a market to generate a targeted research query."}</div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><button onClick={copyQuery} disabled={!researchQuery} className="rounded-xl border border-white/9 bg-white/[0.03] px-3 py-2 text-xs text-white/55 disabled:opacity-30">{copied ? "Copied ✓" : "Copy query"}</button><a href={researchUrl} target="_blank" rel="noreferrer" className={`rounded-xl bg-white px-3 py-2 text-center text-xs font-semibold text-[#061016] ${researchQuery ? "" : "pointer-events-none opacity-30"}`}>Open web research ↗</a></div></div>

              {buyerLoading ? <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.05] p-5 text-sm text-cyan-100">Searching the configured buyer layer...</div> : null}
              {buyerError ? <div className="mt-5 rounded-2xl border border-amber-300/10 bg-amber-300/[0.05] p-5 text-sm text-amber-100">{buyerError}</div> : null}

              {buyers.length ? <div className="mt-5 space-y-3">{buyers.map((buyer, index) => <div key={`${buyer.company || buyer.name || "buyer"}-${index}`} className="rounded-2xl border border-white/7 bg-black/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-medium text-white/85">{buyer.company || buyer.name || "Unnamed company"}</div><div className="mt-1 text-xs text-white/25">{buyer.country || selectedName}</div></div><Badge tone={buyer.verification?.status === "verified" ? "emerald" : "amber"}>{buyer.verification?.label || buyer.verification?.status || "Needs verification"}</Badge></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><Evidence label="Signal" value={buyer.intelligence?.label || buyer.intelligence?.signal || "Research"} /><Evidence label="Shipments" value={num(buyer.matchedShipments)} /><Evidence
  label="Readiness"
  value={
    buyer.readiness === "action-candidate"
      ? "Action candidate"
      : buyer.readiness === "needs-verification"
        ? "Needs verification"
        : buyer.readiness === "research"
          ? "Research"
          : "—"
  }
/></div>{buyer.evidence ? <p className="mt-3 text-xs leading-5 text-white/35">{buyer.evidence}</p> : null}</div>)}</div> : buyerResearch ? <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4"><div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/65">Free buyer research mode</div><div className="mt-2 text-sm text-white/70">No paid company database is being used. The workflow gives you targeted searches you can verify yourself.</div><div className="mt-4 space-y-2">{(buyerResearch.links || []).map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/8 bg-black/10 px-3 py-2.5 text-xs text-white/55 hover:border-cyan-300/15 hover:text-cyan-100"><span>{link.label}</span><span>↗</span></a>)}</div><div className="mt-4 rounded-xl border border-white/7 bg-black/10 p-3 text-[10px] leading-5 text-white/30">{buyerResearch.note || "Verify every company before outreach and keep the source attached to your research record."}</div></div> : <div className="mt-5 grid gap-3 md:grid-cols-3">{[["01", "Find companies"], ["02", "Verify relevance"], ["03", "Record evidence"]].map(([n, title]) => <div key={n} className="rounded-2xl border border-white/7 bg-black/10 p-4"><div className="text-[9px] text-cyan-200/65">{n}</div><div className="mt-2 text-sm text-white/70">{title}</div><div className="mt-1 text-xs leading-5 text-white/25">Use evidence before outreach.</div></div>)}</div>}

              {buyerProvider ? (
                <div className="mt-5 text-[10px] uppercase tracking-[0.14em] text-white/18">
                  Layer: {typeof buyerProvider === "string" ? buyerProvider : buyerProvider.source || buyerProvider.mode || "research"}
                </div>
              ) : null}

              {buyerFallbackReason ? (
                <div className="mt-3 rounded-xl border border-amber-300/10 bg-amber-300/[0.025] px-3 py-2.5 text-[10px] leading-5 text-amber-100/45">
                  Provider fallback: {buyerFallbackReason.replaceAll("_", " ")}.
                  Free research mode is being used instead.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>



      <section
        id="commercial-command-center"
        className="scroll-mt-24 border-y border-white/[0.07] bg-[#05090e]"
      >
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-18">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/65">
                04 / Commercial command center
              </div>

              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">
                From market evidence to a controlled sales decision.
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/38">
                ECC separates destination demand from origin fit, buyer evidence,
                supplier competition and market-access verification.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {v7PlanLabel}
              </span>

              <span className="rounded-full border border-cyan-300/12 bg-cyan-300/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-100/55">
                Evidence first
              </span>
            </div>
          </div>

          {!focusMarket ? (
            <div className="mt-8 rounded-[26px] border border-white/8 bg-white/[0.02] p-6">
              <div className="text-sm font-medium text-white/70">
                Run a market scan to activate the commercial workspace.
              </div>

              <p className="mt-2 max-w-2xl text-xs leading-5 text-white/30">
                The workspace becomes useful once ECC has a real market result
                to validate.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-[24px] border border-white/8 bg-white/[0.025] p-5">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
                    Commercial coverage
                  </div>

                  <div className="mt-3 flex items-end gap-2">
                    <div className="text-3xl font-semibold text-white/85">
                      {commercialCoverage == null ? "—" : commercialCoverage}
                    </div>

                    <div className="pb-1 text-[10px] text-white/22">
                      /100
                    </div>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/6">
                    <div
                      className="h-full rounded-full bg-cyan-300/55"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, commercialCoverage ?? 0)
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-3 text-[10px] leading-5 text-white/28">
                    Evidence coverage, not market attractiveness.
                  </div>
                </article>

                <article className="rounded-[24px] border border-white/8 bg-white/[0.025] p-5">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
                    Origin fit
                  </div>

                  <div className="mt-3 text-lg font-semibold text-white/80">
                    {focusMarket.originExportStatus === "recorded"
                      ? "Recorded"
                      : focusMarket.originExportStatus === "no_record"
                        ? "No bilateral record"
                        : "Unverified"}
                  </div>

                  <p className="mt-2 text-xs leading-5 text-white/30">
                    Missing origin evidence is not treated as zero trade.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("evidence")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                    className="mt-4 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 transition hover:bg-white/[0.05] hover:text-white/65"
                  >
                    Inspect evidence
                  </button>
                </article>

                <article className="rounded-[24px] border border-white/8 bg-white/[0.025] p-5">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
                    Buyer layer
                  </div>

                  <div className="mt-3 text-lg font-semibold text-white/80">
                    {buyerLayerLabel}
                  </div>

                  <div className="mt-2 text-xs leading-5 text-white/30">
                    Verified company records require a connected provider.
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void investigate(focusMarket)
                    }
                    className="mt-4 rounded-xl border border-cyan-300/12 bg-cyan-300/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/55 transition hover:bg-cyan-300/[0.08] hover:text-cyan-100/75"
                  >
                    Run buyer research
                  </button>
                </article>

                <article className="rounded-[24px] border border-white/8 bg-white/[0.025] p-5">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
                    Competition
                  </div>

                  <div className="mt-3 text-lg font-semibold text-white/80">
                    {supplierLayerLabel}
                  </div>

                  <div className="mt-2 text-xs leading-5 text-white/30">
                    Supplier evidence loads on demand to protect upstream rate limits.
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void loadSupplierLandscape(focusMarket)
                    }
                    disabled={supplierLoading}
                    className="mt-4 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 transition hover:bg-white/[0.05] hover:text-white/65 disabled:opacity-40"
                  >
                    {supplierLoading
                      ? "Loading..."
                      : "Load competition"}
                  </button>
                </article>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
                <article className="rounded-[26px] border border-cyan-300/10 bg-cyan-300/[0.025] p-5 md:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/55">
                        Current commercial decision
                      </div>

                      <h3 className="mt-2 text-xl font-semibold text-white/85">
                        {focusMarket.decision?.decisionState ||
                          focusMarket.commercialReadiness?.label ||
                          "Validation candidate"}
                      </h3>
                    </div>

                    <Badge
                      tone={
                        commercialCoverage != null &&
                        commercialCoverage >= 75
                          ? "emerald"
                          : commercialCoverage != null &&
                              commercialCoverage >= 50
                            ? "cyan"
                            : "amber"
                      }
                    >
                      {commercialCoverage == null
                        ? "Evidence unresolved"
                        : commercialCoverage >= 75
                          ? "Strong coverage"
                          : commercialCoverage >= 50
                            ? "Partial coverage"
                            : "Limited coverage"}
                    </Badge>
                  </div>

                  <p className="mt-4 max-w-3xl text-sm leading-7 text-white/42">
                    {commercialNextDecision}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                      <div className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                        Priority
                      </div>

                      <div className="mt-2 text-2xl font-semibold text-white/80">
                        {focusMarket.decision?.priority ?? "—"}
                        <span className="ml-1 text-xs text-white/20">
                          /100
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                      <div className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                        Confidence
                      </div>

                      <div className="mt-2 text-2xl font-semibold text-white/80">
                        {focusMarket.decision?.confidence ?? "—"}
                        <span className="ml-2 text-xs text-cyan-200/45">
                          {focusMarket.decision?.confidenceLabel || ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("decision-workspace")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          })
                      }
                      className="rounded-xl bg-white px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#061016] transition hover:bg-cyan-50"
                    >
                      Open decision workspace
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("buyers")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          })
                      }
                      className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 transition hover:bg-white/[0.05] hover:text-white/70"
                    >
                      Continue to buyers
                    </button>
                  </div>
                </article>

                <article className="rounded-[26px] border border-white/8 bg-white/[0.02] p-5 md:p-6">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
                    Evidence gap queue
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {commercialBlockers.length ? (
                      commercialBlockers.slice(0, 5).map((item, index) => (
                        <div
                          key={`${item}-${index}`}
                          className="flex gap-3 rounded-xl border border-white/6 bg-black/10 p-3"
                        >
                          <span className="text-[10px] font-semibold text-amber-200/60">
                            0{index + 1}
                          </span>

                          <span className="text-xs leading-5 text-white/42">
                            {item}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.025] p-4 text-xs leading-5 text-emerald-100/55">
                        No commercial blocker was returned by the current evidence graph.
                      </div>
                    )}
                  </div>
                </article>
              </div>

              <div className="mt-5 rounded-[26px] border border-white/8 bg-white/[0.02] p-5 md:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">
                      Validation pipeline
                    </div>

                    <h3 className="mt-2 text-lg font-semibold text-white/75">
                      What ECC knows before outreach.
                    </h3>
                  </div>

                  <div className="text-[10px] uppercase tracking-[0.13em] text-white/18">
                    No evidence = no claim
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {[
                    {
                      label: "Market demand",
                      state:
                        commercialEvidence?.layers?.market ||
                        "unavailable",
                    },
                    {
                      label: "Origin fit",
                      state:
                        commercialEvidence?.layers?.origin ||
                        "unavailable",
                    },
                    {
                      label: "Competition",
                      state:
                        commercialEvidence?.layers?.competition ||
                        "not-checked",
                    },
                    {
                      label: "Buyers",
                      state:
                        commercialEvidence?.layers?.buyers ||
                        "not-checked",
                    },
                    {
                      label: "Market access",
                      state:
                        commercialEvidence?.layers?.marketAccess ||
                        "not-checked",
                    },
                  ].map((item) => {
                    const positive =
                      item.state === "strong" ||
                      item.state === "moderate";

                    return (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-white/6 bg-black/10 p-4"
                      >
                        <div className="text-[9px] uppercase tracking-[0.13em] text-white/20">
                          {item.label}
                        </div>

                        <div
                          className={`mt-3 text-sm font-semibold ${
                            positive
                              ? "text-emerald-200/70"
                              : "text-amber-100/55"
                          }`}
                        >
                          {item.state}
                        </div>

                        <div className="mt-2 text-[10px] leading-5 text-white/22">
                          Source-backed status only.
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 rounded-[26px] border border-cyan-300/10 bg-cyan-300/[0.018] p-5 md:p-6">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/55">
                      Pro value ladder
                    </div>

                    <h3 className="mt-2 text-xl font-semibold text-white/82">
                      The product is not selling a bigger dashboard.
                      It is selling deeper commercial evidence.
                    </h3>

                    <p className="mt-2 max-w-3xl text-xs leading-6 text-white/30">
                      Free provides credible market discovery. Pro is designed
                      to unlock buyer intelligence, deeper competition evidence,
                      commercial decision packs and market-access verification
                      when real providers are connected.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setProMode((value) => !value)}
                    className="rounded-2xl bg-white px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#061016] transition hover:bg-cyan-50"
                  >
                    {proMode
                      ? "Close Pro preview"
                      : "Open Pro preview"}
                  </button>
                </div>

                {proMode ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        title: "Buyer intelligence",
                        state:
                          buyers.length
                            ? "Provider-backed"
                            : "Provider required",
                      },
                      {
                        title: "Supplier landscape",
                        state:
                          supplierLoadedForFocus
                            ? "Loaded"
                            : "Available on demand",
                      },
                      {
                        title: "Decision pack",
                        state: "Available",
                      },
                      {
                        title: "Market access",
                        state:
                          focusMarket.marketAccess?.status ||
                          "Verification required",
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="rounded-2xl border border-white/7 bg-black/15 p-4"
                      >
                        <div className="text-xs font-medium text-white/65">
                          {item.title}
                        </div>

                        <div className="mt-2 text-[10px] leading-5 text-white/30">
                          {item.state}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>

<section id="pro" className="mx-auto mt-16 w-full max-w-7xl px-4 sm:px-6">
<div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-300/15 bg-cyan-300/8 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70">
              Pro Mode
            </span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/20">
              Decision layer
            </span>
          </div>
          <div className="mt-2 text-sm font-medium text-white/70">
            Turn evidence-backed market signals into a commercial validation pack.
          </div>
          <div className="mt-1 text-xs text-white/30">
            Preview deeper evidence workflows, buyer research, market-access checks, and monitoring without inventing unsupported data.
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const next = !proMode;
            setProMode(next);

            if (next) {
              window.setTimeout(() => {
                document.getElementById("pro-pack")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }, 70);
            }
          }}
          className="rounded-xl border border-cyan-300/15 bg-cyan-300/8 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100 transition hover:bg-cyan-300/12"
        >
          {proMode ? "Pro Mode On" : "Preview Pro intelligence"}
        </button>
      </div>


      {proMode && (selectedMarket || rankedMarkets[0]) && (() => {
        const market = selectedMarket ?? rankedMarkets[proMarketIndex] ?? rankedMarkets[0];
        const pack = proPackFor(market, rankedMarkets);

        return (
          <section
            id="pro-pack"
            className="mb-10 scroll-mt-24 rounded-3xl border border-cyan-300/12 bg-cyan-300/[0.025] p-5 md:p-6"
          >
            <div className="flex flex-col gap-4 border-b border-white/7 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-cyan-300/15 bg-cyan-300/8 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/70">
                    PRO DECISION PACK
                  </span>
                  <span className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                    Decision focus
                  </span>
                </div>

                <h2 className="mt-3 text-xl font-semibold text-white/85">
                  {pack.marketName}
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-white/35">
                  A deeper commercial validation layer built from the evidence currently available.
                  Validation priority is an action signal, not proof of a sale.
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      proDecisionTextFor(market)
                    );
                    setProCopied(true);
                    window.setTimeout(() => setProCopied(false), 1800);
                  } catch {}
                }}
                className="shrink-0 rounded-xl border border-white/8 bg-white/[0.035] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/55 transition hover:bg-white/[0.06] hover:text-white/75"
              >
                {proCopied ? "Copied" : "Copy Decision Pack"}
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/6 bg-black/15 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                    Focus market
                  </div>
                  <div className="mt-1 text-xs text-white/35">
                    Choose the market the Pro decision pack should analyze.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {rankedMarkets.slice(0, 5).map((item, index) => {
                    const name =
                      item.country ||
                      item.marketName ||
                      item.market ||
                      `Market ${index + 1}`;

                    const active = selectedMarket
                      ? marketKey(selectedMarket) === marketKey(item)
                      : index === proMarketIndex;

                    return (
                      <button
                        key={`${name}-${index}`}
                        type="button"
                        onClick={() => {
                          setProMarketIndex(index);
                          setSelectedMarket(item);
                        }}
                        className={`rounded-xl border px-3 py-2 text-[10px] font-semibold transition ${
                          active
                            ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
                            : "border-white/7 bg-white/[0.025] text-white/40 hover:bg-white/[0.05] hover:text-white/65"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                  Priority
                </div>
                <div className="mt-2 text-2xl font-semibold text-white/80">
                  {pack.priority}
                  <span className="ml-1 text-xs text-white/20">/100</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                  Confidence
                </div>
                <div className="mt-2 text-2xl font-semibold text-white/80">
                  {pack.confidence}
                  <span className="ml-2 text-xs text-cyan-200/45">
                    {pack.confidenceLabel}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                  Evidence
                </div>
                <div className="mt-2 text-2xl font-semibold text-white/80">
                  {pack.evidence}
                  <span className="ml-1 text-xs text-white/20">/100</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                  Origin fit
                </div>
                <div className="mt-2 text-sm font-semibold text-white/65">
                  {pack.originStatus}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                  Evidence assessment
                </div>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  {pack.evidenceState}
                </p>
              </div>

              <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                  Commercial readiness
                </div>
                <div className="mt-2 text-sm font-semibold text-white/70">
                  {pack.commercialState}
                </div>
                <p className="mt-2 text-xs leading-5 text-white/35">
                  {pack.commercialReason}
                </p>
              </div>

              <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                  Pro-only validation gaps
                </div>
                <div className="mt-2 space-y-2">
                  {[
                    "Qualified buyer evidence",
                    "Market-access verification",
                    "Competitive / origin comparison",
                    "Supplier-side commercial fit",
                  ].map((item) => (
                    <div key={item} className="flex gap-2 text-xs leading-5 text-white/40">
                      <span className="text-cyan-200/55">+</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                  Evidence boundary
                </div>
                <p className="mt-2 text-sm leading-6 text-white/40">
                  Buyer/company records and market-access claims stay unverified
                  until a source or provider supports them.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                  Evidence ledger
                </div>

                <div className="mt-3 space-y-2">
                  {[
                    {
                      label: "Demand",
                      state: "Supported",
                      detail: "Destination import demand",
                    },
                    {
                      label: "Growth",
                      state: (market.yoyGrowth ?? market.growth) != null ? "Supported" : "Missing",
                      detail: "Recent market movement",
                    },
                    {
                      label: "Origin fit",
                      state:
                        market.originExportStatus === "recorded"
                          ? "Recorded"
                          : market.originExportStatus === "no_record"
                            ? "No record"
                            : "Unavailable",
                      detail: "Origin-specific evidence",
                    },
                    {
                      label: "Buyer evidence",
                      state: buyers.length ? "Available" : "Not verified",
                      detail: buyerProvider
                        ? "Configured buyer layer"
                        : "No verified provider result",
                    },
                    {
                      label: "Market access",
                      state: "Not verified",
                      detail: "Tariff / regulation / certification",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.018] px-3 py-2.5"
                    >
                      <div>
                        <div className="text-xs text-white/65">{item.label}</div>
                        <div className="mt-0.5 text-[10px] text-white/20">{item.detail}</div>
                      </div>
                      <span
                        className={`text-[10px] font-semibold ${
                          item.state === "Supported" ||
                          item.state === "Recorded" ||
                          item.state === "Available"
                            ? "text-emerald-300/75"
                            : "text-amber-200/65"
                        }`}
                      >
                        {item.state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                  Decision brief
                </div>

                <div className="mt-3 rounded-xl border border-cyan-300/8 bg-cyan-300/[0.02] p-3">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-cyan-200/45">
                    Current decision
                  </div>

                  <div className="mt-1 text-sm font-semibold text-white/75">
                    {pack.commercialState}
                  </div>

                  <p className="mt-2 text-xs leading-5 text-white/40">
                    {pack.commercialReason}
                  </p>
                </div>

                <div className="mt-3 space-y-2">
                  {(pack.unknowns ?? []).slice(0, 3).map((item, index) => (
                    <div
                      key={item}
                      className="flex gap-2 text-xs leading-5 text-white/40"
                    >
                      <span className="text-amber-300/60">
                        0{index + 1}
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/6 bg-black/15 p-4">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                  Provider readiness
                </div>

                <div className="mt-3">
                  <div className="text-xs text-white/60">
                    Buyer intelligence
                  </div>

                  <div className="mt-2 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.018] px-3 py-2.5">
                    <span className="text-[10px] text-white/30">
                      Status
                    </span>
                    <span className={`text-[10px] font-semibold ${
                      buyerProvider
                        ? "text-emerald-300/75"
                        : "text-amber-200/65"
                    }`}>
                      {buyerProvider
                        ? "Provider configured"
                        : "Research only"}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.018] px-3 py-2.5">
                    <span className="text-[10px] text-white/30">
                      Verified records
                    </span>
                    <span className="text-[10px] font-semibold text-white/55">
                      {buyers.length}
                    </span>
                  </div>

                  <p className="mt-3 text-[10px] leading-5 text-white/25">
                    Pro never converts missing provider data into a positive
                    commercial claim.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/6 bg-black/15 p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                    Market comparison
                  </div>
                  <div className="mt-1 text-xs text-white/30">
                    Compare opportunity strength with decision confidence instead of ranking by demand alone.
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[1.4fr_.55fr_.65fr_.8fr_.7fr] gap-3 border-b border-white/6 pb-2 text-[9px] uppercase tracking-[0.12em] text-white/20">
                    <span>Market</span>
                    <span>Validation priority</span>
                    <span>Confidence</span>
                    <span>Origin</span>
                    <span>YoY</span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {pack.rankedComparison.map((item) => (
                      <div
                        key={item.name}
                        className="grid grid-cols-[1.4fr_.55fr_.65fr_.8fr_.7fr] gap-3 py-3 text-xs text-white/45"
                      >
                        <span className="font-medium text-white/65">
                          {item.name}
                        </span>
                        <span>{item.priority}</span>
                        <span>{item.confidence}</span>
                        <span>{item.origin}</span>
                        <span>
                          {item.growth == null
                            ? "—"
                            : `${item.growth > 0 ? "+" : ""}${item.growth.toFixed(1)}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/6 bg-black/15 p-4">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
                Validation sequence
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {pack.validationSteps.map((item, index) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/5 bg-white/[0.018] p-3"
                  >
                    <div className="text-[9px] uppercase tracking-[0.12em] text-cyan-200/45">
                      0{index + 1}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-white/50">
                      {item}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}
      </section>




      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-[10px] uppercase tracking-[0.14em] text-white/18 md:flex-row md:items-center md:justify-between md:px-8">
          <span>Export Command Center · evidence-driven market intelligence</span>
          <span>Validate before you scale</span>
        </div>
      </footer>
</main>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3.5"><div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/22">{label}</div><div className="mt-2 text-base font-semibold text-white">{value}</div>{detail ? <div className="mt-1 text-[10px] text-white/25">{detail}</div> : null}</div>;
}

function Badge({ tone, children }: { tone: "emerald" | "cyan" | "amber" | "slate"; children: React.ReactNode }) {
  const cls = tone === "emerald" ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200" : tone === "cyan" ? "border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-200" : tone === "amber" ? "border-amber-300/15 bg-amber-300/[0.06] text-amber-200" : "border-white/8 bg-white/[0.03] text-white/40";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${cls}`}>{children}</span>;
}

function Evidence({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-2xl border border-white/7 bg-black/10 p-3.5"><div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/20">{label}</div><div className="mt-2 text-sm text-white/65">{value}</div>{note ? <div className="mt-1 text-[10px] leading-5 text-white/22">{note}</div> : null}</div>;
}

function Dot({ good, label }: { good: boolean; label: string }) {
  return <span className="inline-flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${good ? "bg-emerald-300" : "bg-white/20"}`} />{label}</span>;
}

function Method({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-white/7 bg-black/10 p-4"><div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/20">{title}</div><p className="mt-2 text-sm leading-6 text-white/40">{body}</p></div>;
}
