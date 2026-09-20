"use client";

import { FormEvent, useState } from "react";

type Market = {
  countryCode: number;
  country: string;
  importValue: number;
  quantity: number;
  unit: string | null;
  demandScore: number;
  isReported: boolean;
  isEstimated: boolean;
  previousImportValue: number | null;
  growthRate: number | null;
  trend: string;
  originExportValue: number | null;
  originExportStatus:
    | "recorded"
    | "no_record"
    | "rate_limited"
    | "data_unavailable"
    | "unavailable"
    | null;
  originShare: number | null;
  opportunity: {
    signal:
      | "strong-validation-target"
      | "validation-target"
      | "monitor"
      | "insufficient-evidence";
    score: number;
    label: string;
    reasons: string[];
    missingEvidence: string[];
    nextAction: string;
  };
  intelligence: {
    evidenceScore: number;
    evidenceLabel: "High" | "Medium" | "Low";
    evidenceStatus:
      | "strong"
      | "moderate"
      | "limited"
      | "unavailable";
    decisionSignal:
      | "promising"
      | "watch"
      | "insufficient-evidence";
    marketPriority:
      | "priority"
      | "monitor"
      | "research";
    decisionLabel: string;
    nextAction: string;
    evidence: {
      key: string;
      label: string;
      value: string;
      status:
        | "strong"
        | "moderate"
        | "limited"
        | "unavailable";
      source: string;
      note?: string;
    }[];
    limitations: string[];
  };
};

type Buyer = {
  id: string;
  companyName: string;
  companyLink: string | null;
  countryCode: number;
  country: string | null;
  shipmentCount: number | null;
  matchingShipments: number | null;
  lastShipmentDate: string | null;
  productMatch: string | null;
  relevanceScore: number | null;
  specialization: number | null;
  supplierCount: number | null;
  source: string;
  evidenceStatus:
    | "strong"
    | "moderate"
    | "limited";
};

type BuyerSummary = {
  total: number;
  highSignal: number;
  mediumSignal: number;
  lowSignal: number;
  verified: number;
  partiallyVerified: number;
  unverified: number;
};

type BuyerAnalysis = {
  buyer: Buyer;
  intelligence: {
    signal:
      | "high-signal"
      | "medium-signal"
      | "low-signal"
      | "insufficient-evidence";
    signalScore: number;
    reasons: string[];
    nextAction: string;
  };
  evidence: {
    status:
      | "strong"
      | "moderate"
      | "limited"
      | "unavailable";
    score: number;
    signals: string[];
    limitations: string[];
  };
  verification: {
    status:
      | "verified"
      | "partially-verified"
      | "unverified";
    score: number;
    verifiedSignals: string[];
    missingSignals: string[];
  };
  readiness:
    | "outreach-ready"
    | "needs-verification"
    | "research";
};

type BuyerProviderMeta = {
  provider: string;
  requestCost: number | null;
  creditsRemaining: number | null;
  requestId: string | null;
  fetchedAt: string;
};

type BuyerResponse = {
  available: boolean;
  provider?: string;
  status?: string;
  reason?: string;
  hsCode: string;
  marketCountryCode: number;
  buyers: BuyerAnalysis[];
  summary: BuyerSummary;
  limitations: string[];
  providerMeta?: BuyerProviderMeta;
};

type AnalysisResponse = {
  ok: boolean;
  source?: string;
  year?: string;
  hsCode?: string;
  markets?: Market[];
  count?: number;
  screening?: {
    methodology: string;
    globalMarketsReturned: number;
    screenedMarkets: number;
    originQueries: number;
    originDataAvailability:
      | "available"
      | "unavailable"
      | "unknown"
      | null;
    maxOriginCandidates: number;
  };
  evidence?: {
    source: string;
    methodology: string;
    preview: boolean;
  };
  error?: string;
};

function formatImportValue(value: number) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }

  return `$${Math.round(value).toLocaleString()}`;
}

function getOpportunityTone(
  signal: Market["opportunity"]["signal"]
) {
  if (signal === "strong-validation-target") {
    return {
      label: "High-priority validation",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (signal === "validation-target") {
    return {
      label: "Validation target",
      className:
        "border-blue-500/20 bg-blue-500/10 text-blue-300",
    };
  }

  if (signal === "monitor") {
    return {
      label: "Monitor",
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-300",
    };
  }

  return {
    label: "Needs evidence",
    className:
      "border-slate-700 bg-slate-900 text-slate-400",
  };
}

function getOriginStatusLabel(
  status: Market["originExportStatus"]
) {
  switch (status) {
    case "recorded":
      return "Origin record";
    case "no_record":
      return "No bilateral record";
    case "data_unavailable":
      return "Origin dataset unavailable";
    case "rate_limited":
      return "Temporarily limited";
    case "unavailable":
      return "Origin evidence unavailable";
    default:
      return "Not checked";
  }
}

function getOriginStatusClass(
  status: Market["originExportStatus"]
) {
  if (status === "recorded") {
    return "text-emerald-300";
  }

  if (status === "data_unavailable") {
    return "text-amber-300";
  }

  return "text-slate-400";
}

export default function Home() {
  const [product, setProduct] = useState("");
  const [origin, setOrigin] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [year, setYear] = useState("2024");

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [screening, setScreening] =
    useState<AnalysisResponse["screening"] | null>(
      null
    );

  const [selectedMarket, setSelectedMarket] =
    useState<Market | null>(null);
  const [buyers, setBuyers] = useState<
    BuyerAnalysis[]
  >([]);
  const [buyerSummary, setBuyerSummary] =
    useState<BuyerSummary | null>(null);
  const [buyerProvider, setBuyerProvider] =
    useState("");
  const [buyerLoading, setBuyerLoading] =
    useState(false);
  const [buyerError, setBuyerError] =
    useState("");
  const [researchCopied, setResearchCopied] =
    useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanProduct = product.trim();
    const cleanOrigin = origin.trim();
    const cleanHsCode = hsCode.trim();

    if (
      !cleanProduct ||
      !cleanOrigin ||
      !/^\d{2,6}$/.test(cleanHsCode)
    ) {
      return;
    }

    setLoading(true);
    setSearched(false);
    setError("");
    setMarkets([]);
    setScreening(null);

    setSelectedMarket(null);
    setBuyers([]);
    setBuyerSummary(null);
    setBuyerProvider("");
    setBuyerError("");
    setResearchCopied(false);

    try {
      const params = new URLSearchParams({
        hsCode: cleanHsCode,
        year,
        origin: cleanOrigin,
      });

      const response = await fetch(
        `/api/analyze?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data: AnalysisResponse =
        await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Analysis failed."
        );
      }

      setMarkets(data.markets ?? []);
      setScreening(data.screening ?? null);
      setSearched(true);

      window.setTimeout(() => {
        document
          .getElementById("market-results")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 50);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to retrieve trade data."
      );
    } finally {
      setLoading(false);
    }
  }

  function getResearchQuery(market: Market) {
    return `"${product.trim()}" importer buyer "${market.country}" HS ${hsCode.trim()}`;
  }

  function getResearchUrl(market: Market) {
    return `https://www.google.com/search?q=${encodeURIComponent(
      getResearchQuery(market)
    )}`;
  }

  async function copyResearchQuery(
    market: Market
  ) {
    const query = getResearchQuery(market);

    try {
      await navigator.clipboard.writeText(query);
      setResearchCopied(true);

      window.setTimeout(() => {
        setResearchCopied(false);
      }, 2000);
    } catch {
      setResearchCopied(false);
    }
  }

  async function loadBuyers(market: Market) {
    setSelectedMarket(market);
    setBuyers([]);
    setBuyerSummary(null);
    setBuyerProvider("");
    setBuyerError("");
    setResearchCopied(false);
    setBuyerLoading(true);

    try {
      const params = new URLSearchParams({
        hsCode: hsCode.trim(),
        market: String(market.countryCode),
        productDescription: product.trim(),
        limit: "10",
      });

      const response = await fetch(
        `/api/buyers?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as BuyerResponse;

      if (!response.ok) {
        throw new Error(
          typeof data.reason === "string"
            ? data.reason
            : "Buyer search failed."
        );
      }

      setBuyerProvider(data.provider ?? "");
      setBuyers(data.buyers ?? []);
      setBuyerSummary(data.summary ?? null);

      if (
        !data.available &&
        data.limitations?.length
      ) {
        setBuyerError(data.limitations[0]);
      }

      window.setTimeout(() => {
        document
          .getElementById("buyer-intelligence")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 50);
    } catch (err) {
      setBuyerError(
        err instanceof Error
          ? err.message
          : "Buyer search failed."
      );
    } finally {
      setBuyerLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070b14] text-white selection:bg-blue-500/30">
      <nav className="sticky top-0 z-30 border-b border-white/5 bg-[#070b14]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a
            href="#top"
            className="group"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                EC
              </div>

              <div>
                <div className="text-sm font-bold tracking-tight">
                  Export Command Center
                </div>
                <div className="text-[11px] text-slate-500">
                  Evidence-driven export intelligence
                </div>
              </div>
            </div>
          </a>

          <div className="hidden items-center gap-7 text-xs font-medium text-slate-400 sm:flex">
            <a
              href="#market-results"
              className="transition hover:text-white"
            >
              Markets
            </a>
            <a
              href="#buyer-intelligence"
              className="transition hover:text-white"
            >
              Buyers
            </a>
            <a
              href="#methodology"
              className="transition hover:text-white"
            >
              Evidence
            </a>
            <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-slate-300">
              MVP
            </span>
          </div>
        </div>
      </nav>

      <section
        id="top"
        className="relative overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute right-0 top-40 h-64 w-64 rounded-full bg-cyan-500/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Export Intelligence
            </div>

            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Find the markets worth
              <span className="block bg-gradient-to-r from-blue-300 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
                your next export move.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Start with real international trade data,
              understand what the evidence actually supports,
              and leave with a clear next validation step.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {[
                "Real trade data",
                "Transparent signals",
                "Evidence gaps",
                "Buyer research",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/7 bg-white/3 px-3.5 py-2 text-xs text-slate-400"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-12 max-w-6xl rounded-[28px] border border-white/8 bg-white/[0.035] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.15fr_0.8fr_1fr_0.72fr_auto] xl:items-end">
              <div>
                <label
                  htmlFor="product"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Product
                </label>

                <input
                  id="product"
                  required
                  maxLength={120}
                  value={product}
                  onChange={(event) =>
                    setProduct(event.target.value)
                  }
                  placeholder="e.g. Coffee"
                  className="w-full rounded-2xl border border-white/8 bg-[#090f1b] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <div>
                <label
                  htmlFor="hsCode"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  HS Code
                </label>

                <input
                  id="hsCode"
                  required
                  value={hsCode}
                  onChange={(event) =>
                    setHsCode(
                      event.target.value.replace(
                        /\D/g,
                        ""
                      )
                    )
                  }
                  placeholder="0901"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{2,6}"
                  className="w-full rounded-2xl border border-white/8 bg-[#090f1b] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <div>
                <label
                  htmlFor="origin"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Export Origin
                </label>

                <input
                  id="origin"
                  required
                  value={origin}
                  onChange={(event) =>
                    setOrigin(event.target.value)
                  }
                  placeholder="e.g. Iran"
                  list="origin-suggestions"
                  className="w-full rounded-2xl border border-white/8 bg-[#090f1b] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                />

                <datalist id="origin-suggestions">
                  <option value="Iran" />
                  <option value="United States" />
                  <option value="Germany" />
                  <option value="Turkey" />
                  <option value="China" />
                  <option value="India" />
                  <option value="Italy" />
                  <option value="Canada" />
                  <option value="Spain" />
                  <option value="Japan" />
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="year"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Trade Year
                </label>

                <select
                  id="year"
                  value={year}
                  onChange={(event) =>
                    setYear(event.target.value)
                  }
                  className="w-full rounded-2xl border border-white/8 bg-[#090f1b] px-4 py-3.5 text-sm text-white outline-none transition focus:border-blue-500/60 focus:ring-4 focus:ring-blue-500/10"
                >
                  {[
                    "2026",
                    "2025",
                    "2024",
                    "2023",
                    "2022",
                    "2021",
                    "2020",
                  ].map((option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option}
                      {option === "2026"
                        ? " · current"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  !product.trim() ||
                  !origin.trim() ||
                  !/^\d{2,6}$/.test(
                    hsCode.trim()
                  )
                }
                className="rounded-2xl bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 hover:shadow-blue-900/30 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading
                  ? "Analyzing..."
                  : "Find Markets"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                <span>Annual trade data</span>
                <span>Demand + growth screening</span>
                <span>Origin validation</span>
              </div>

              <span className="text-[11px] text-slate-600">
                2–6 digit HS code
              </span>
            </div>
          </form>
        </div>
      </section>

      {error && (
        <section className="border-y border-red-500/10 bg-red-500/5">
          <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
            <div
              role="alert"
              className="rounded-2xl border border-red-500/15 bg-red-950/20 p-5"
            >
              <p className="text-sm font-semibold text-red-300">
                Analysis could not be completed
              </p>
              <p className="mt-2 text-sm leading-6 text-red-200/70">
                {error}
              </p>
            </div>
          </div>
        </section>
      )}

      {searched && (
        <section
          id="market-results"
          className="scroll-mt-24 border-y border-white/6 bg-[#0a0f1a]"
        >
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-18">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-emerald-500/15 bg-emerald-500/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                    Live trade analysis
                  </span>

                  <span className="text-xs text-slate-600">
                    {year} annual data
                  </span>
                </div>

                <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Markets worth validating for{" "}
                  <span className="text-blue-300">
                    {product}
                  </span>
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Origin: {origin} · HS {hsCode} ·
                  The engine screens demand and growth first,
                  then checks origin-specific evidence where
                  the source provides it.
                </p>
              </div>

              <div className="rounded-2xl border border-white/7 bg-white/[0.025] px-5 py-4">
                <div className="text-2xl font-bold text-white">
                  {markets.length}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  validation candidates
                </div>
              </div>
            </div>

            {screening && (
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Markets screened"
                  value={String(
                    screening.globalMarketsReturned
                  )}
                  detail="Global import records returned"
                />

                <Metric
                  label="Candidates"
                  value={String(
                    screening.screenedMarkets
                  )}
                  detail="Passed transparent screening"
                  emphasis="blue"
                />

                <Metric
                  label="Origin evidence"
                  value={
                    screening.originDataAvailability ===
                    "available"
                      ? "Available"
                      : screening.originDataAvailability ===
                          "unavailable"
                        ? "Unavailable"
                        : screening.originDataAvailability ===
                            "unknown"
                          ? "Unknown"
                          : "Not requested"
                  }
                  detail={`${screening.originQueries} bilateral queries`}
                />
              </div>
            )}

            {markets.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-slate-500">
                  —
                </div>
                <p className="mt-4 font-semibold text-white">
                  No screened markets were returned.
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Try another HS code or trade year.
                  A market is only shown when it passes
                  the transparent demand/growth screen.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-5 lg:grid-cols-2">
                {markets.slice(0, 12).map((market, index) => {
                  const tone = getOpportunityTone(
                    market.opportunity.signal
                  );

                  return (
                    <article
                      key={market.countryCode}
                      className="group rounded-3xl border border-white/7 bg-white/[0.025] p-5 transition hover:border-blue-500/20 hover:bg-white/[0.035] sm:p-6"
                    >
                      <div className="flex flex-col gap-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                                #{index + 1}
                              </span>

                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tone.className}`}
                              >
                                {tone.label}
                              </span>
                            </div>

                            <h3 className="mt-3 text-2xl font-bold tracking-tight text-white">
                              {market.country}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500">
                              Import-market signal
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-4xl font-bold tracking-tight text-blue-300">
                              {market.opportunity.score}
                            </div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-600">
                              Validation
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">
                              Relative demand
                            </span>

                            <span className="font-semibold text-slate-300">
                              {market.demandScore}/100
                            </span>
                          </div>

                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-400"
                              style={{
                                width: `${market.demandScore}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <StatCard
                            label="Import value"
                            value={formatImportValue(
                              market.importValue
                            )}
                            detail="Current-year imports"
                          />

                          <StatCard
                            label="YoY growth"
                            value={
                              market.growthRate ===
                              null
                                ? "—"
                                : `${
                                    market.growthRate >
                                    0
                                      ? "+"
                                      : ""
                                  }${market.growthRate}%`
                            }
                            detail={market.trend}
                          />

                          <StatCard
                            label="Trade record"
                            value={
                              market.isReported
                                ? "Reported"
                                : "Source data"
                            }
                            detail="UN Comtrade"
                          />

                          <StatCard
                            label="Quantity"
                            value={
                              market.quantity > 0
                                ? Math.round(
                                    market.quantity
                                  ).toLocaleString()
                                : "—"
                            }
                            detail={
                              market.quantity > 0
                                ? market.isEstimated
                                  ? "Estimated quantity"
                                  : "Quantity available"
                                : "Not available"
                            }
                          />
                        </div>

                        <div className="rounded-2xl border border-white/6 bg-[#080d17] p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                                Opportunity logic
                              </p>

                              <p className="mt-2 text-sm font-semibold text-white">
                                {market.opportunity.label}
                              </p>
                            </div>

                            <div className="text-right">
                              <div className="text-lg font-bold text-slate-200">
                                {market.intelligence.evidenceScore}
                              </div>
                              <div className="text-[10px] uppercase tracking-wider text-slate-600">
                                evidence
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            {market.opportunity.reasons
                              .slice(0, 3)
                              .map((reason) => (
                                <div
                                  key={reason}
                                  className="flex gap-2 text-xs leading-5 text-slate-300"
                                >
                                  <span className="text-emerald-400">
                                    ✓
                                  </span>
                                  <span>{reason}</span>
                                </div>
                              ))}
                          </div>

                          {market.opportunity.missingEvidence
                            .length > 0 && (
                            <div className="mt-4 border-t border-white/6 pt-4">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/80">
                                Evidence gap
                              </p>

                              <p className="mt-2 text-xs leading-5 text-amber-200/75">
                                {
                                  market.opportunity
                                    .missingEvidence[0]
                                }
                              </p>
                            </div>
                          )}

                          <div className="mt-4 border-t border-white/6 pt-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                              Next action
                            </p>

                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              {market.opportunity.nextAction}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 rounded-2xl border border-white/6 bg-white/[0.018] p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p
                              className={`text-xs font-semibold ${getOriginStatusClass(
                                market.originExportStatus
                              )}`}
                            >
                              {getOriginStatusLabel(
                                market.originExportStatus
                              )}
                            </p>

                            <p className="mt-1 text-[11px] leading-5 text-slate-600">
                              {market.originShare !==
                              null
                                ? `${market.originShare}% of this market's imports`
                                : market.originExportStatus ===
                                    "no_record"
                                  ? "No bilateral record returned"
                                  : market.originExportStatus ===
                                      "data_unavailable"
                                    ? "The source did not provide an origin dataset"
                                    : "Origin evidence requires validation"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              loadBuyers(market)
                            }
                            disabled={buyerLoading}
                            className="inline-flex w-full items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/8 px-4 py-3 text-sm font-semibold text-blue-300 transition hover:border-blue-500/40 hover:bg-blue-500/14 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                          >
                            {buyerLoading &&
                            selectedMarket?.countryCode ===
                              market.countryCode
                              ? "Investigating..."
                              : "Investigate buyers →"}
                          </button>
                        </div>

                        <details className="rounded-2xl border border-white/5 bg-[#080d17] p-4">
                          <summary className="cursor-pointer list-none text-xs font-semibold text-slate-400">
                            View evidence details
                          </summary>

                          <div className="mt-4 space-y-3">
                            {market.intelligence.evidence.map(
                              (item) => (
                                <div
                                  key={item.key}
                                  className="flex items-start justify-between gap-4 text-xs"
                                >
                                  <div className="min-w-0">
                                    <p className="text-slate-500">
                                      {item.label}
                                    </p>
                                    {item.note && (
                                      <p className="mt-1 text-[11px] leading-5 text-slate-600">
                                        {item.note}
                                      </p>
                                    )}
                                  </div>

                                  <div className="shrink-0 text-right">
                                    <p className="font-medium text-slate-200">
                                      {item.value}
                                    </p>
                                    <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">
                                      {item.status}
                                    </p>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </details>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {screening && (
              <details
                id="methodology"
                className="mt-8 rounded-3xl border border-white/6 bg-white/[0.02] p-5 sm:p-6"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-300">
                  How the screening works
                </summary>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <ExplainCard
                    number="01"
                    title="Screen"
                    text="Global import demand and year-over-year growth are checked before origin-specific validation."
                  />

                  <ExplainCard
                    number="02"
                    title="Validate"
                    text="Only screened candidates move into origin-specific evidence checks where the source supports them."
                  />

                  <ExplainCard
                    number="03"
                    title="Act"
                    text="The result shows what supports the signal, what is missing, and what should be validated next."
                  />
                </div>

                <p className="mt-5 text-xs leading-5 text-slate-600">
                  {screening.methodology}
                </p>
              </details>
            )}

            <section
              id="buyer-intelligence"
              className="scroll-mt-24 mt-12 rounded-[30px] border border-white/7 bg-white/[0.025] p-6 sm:p-8"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">
                      Buyer Intelligence
                    </span>

                    <span className="rounded-full border border-blue-500/15 bg-blue-500/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                      Evidence layer
                    </span>
                  </div>

                  <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                    Turn a market signal into buyer research.
                  </h3>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                    Select a market to investigate companies.
                    Automated buyer data is provider-dependent;
                    manual research never gets presented as verified
                    buyer evidence.
                  </p>
                </div>

                {selectedMarket && (
                  <div className="rounded-2xl border border-white/7 bg-[#080d17] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-600">
                      Selected market
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {selectedMarket.country}
                    </div>
                  </div>
                )}
              </div>

              {!selectedMarket && !buyerLoading && (
                <EmptyState
                  title="Choose a market above"
                  text="Use “Investigate buyers” on any market to start the next evidence step."
                />
              )}

              {buyerLoading && (
                <div
                  role="status"
                  className="mt-7 rounded-3xl border border-blue-500/15 bg-blue-500/6 p-8 text-center"
                >
                  <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-blue-500/15" />
                  <p className="mt-4 text-sm font-medium text-blue-300">
                    Investigating buyer evidence...
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    Checking the configured provider and preparing the
                    evidence layer.
                  </p>
                </div>
              )}

              {!buyerLoading && buyerError && selectedMarket && (
                <div className="mt-7 space-y-5">
                  <div className="rounded-3xl border border-amber-500/15 bg-amber-500/6 p-5">
                    <p className="text-sm font-semibold text-amber-300">
                      Live buyer data unavailable
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {buyerError}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-blue-500/15 bg-blue-500/6 p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">
                          Free Research Mode
                        </div>

                        <h4 className="mt-3 text-xl font-bold">
                          Continue research without a paid buyer API.
                        </h4>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                          We do not invent buyer records when a live provider
                          is unavailable. Instead, use the generated research
                          brief to find and verify real companies manually.
                        </p>
                      </div>

                      {selectedMarket.countryCode ===
                        840 && (
                        <a
                          href="https://www.importyeti.com/"
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/8 px-4 py-3 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/14"
                        >
                          Open ImportYeti →
                        </a>
                      )}
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/7 bg-[#080d17] p-5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        Research brief
                      </div>

                      <p className="mt-3 break-words text-sm leading-6 text-slate-200">
                        {getResearchQuery(
                          selectedMarket
                        )}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            copyResearchQuery(
                              selectedMarket
                            )
                          }
                          className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.05]"
                        >
                          {researchCopied
                            ? "Copied ✓"
                            : "Copy research query"}
                        </button>

                        <a
                          href={getResearchUrl(
                            selectedMarket
                          )}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="rounded-xl border border-blue-500/25 bg-blue-500/8 px-4 py-2.5 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/14"
                        >
                          Open web research →
                        </a>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <ResearchStep
                        number="01"
                        title="Find"
                        text="Locate importers, distributors, and relevant companies in the selected market."
                      />

                      <ResearchStep
                        number="02"
                        title="Verify"
                        text="Check company identity, product relevance, activity, and recency before trusting the lead."
                      />

                      <ResearchStep
                        number="03"
                        title="Record"
                        text="Only promote a company toward outreach after the supporting evidence is independently checked."
                      />
                    </div>

                    {selectedMarket.countryCode !==
                      840 && (
                      <p className="mt-5 text-xs leading-5 text-slate-600">
                        ImportYeti&apos;s free search is focused on US import
                        data. For other markets, use the provider-agnostic
                        research workflow above.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!buyerLoading &&
                !buyerError &&
                selectedMarket &&
                buyerSummary && (
                  <div className="mt-7">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Metric
                        label="Buyers found"
                        value={String(
                          buyerSummary.total
                        )}
                        detail="Provider result"
                      />

                      <Metric
                        label="Strong signal"
                        value={String(
                          buyerSummary.highSignal
                        )}
                        detail="Evidence-rich"
                      />

                      <Metric
                        label="Verified"
                        value={String(
                          buyerSummary.verified
                        )}
                        detail="Verification threshold"
                      />

                      <Metric
                        label="Needs verification"
                        value={String(
                          buyerSummary.partiallyVerified
                        )}
                        detail="Still requires review"
                      />
                    </div>

                    {buyerProvider === "mock" && (
                      <div className="mt-5 rounded-2xl border border-amber-500/15 bg-amber-500/6 p-4">
                        <p className="text-xs font-semibold text-amber-300">
                          Development test data
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          These records are for product testing only and are
                          not live buyer evidence.
                        </p>
                      </div>
                    )}

                    {buyers.length > 0 ? (
                      <div className="mt-6 grid gap-4 lg:grid-cols-2">
                        {buyers.map((item) => (
                          <article
                            key={item.buyer.id}
                            className="rounded-3xl border border-white/7 bg-[#080d17] p-5"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h4 className="font-semibold text-white">
                                  {item.buyer.companyName}
                                </h4>

                                <p className="mt-1 text-xs text-slate-600">
                                  {item.buyer.country ??
                                    "Unknown country"}
                                </p>
                              </div>

                              <span className="rounded-full border border-white/7 bg-white/[0.02] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                {item.intelligence.signal ===
                                "high-signal"
                                  ? "Strong evidence"
                                  : item.intelligence
                                          .signal ===
                                      "medium-signal"
                                    ? "Moderate evidence"
                                    : item.intelligence
                                            .signal ===
                                        "low-signal"
                                      ? "Limited evidence"
                                      : "Insufficient evidence"}
                              </span>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3">
                              <StatCard
                                label="Matched shipments"
                                value={
                                  item.buyer
                                    .matchingShipments ??
                                  "—"
                                }
                                detail="Product-specific"
                              />

                              <StatCard
                                label="Evidence strength"
                                value={`${item.evidence.score}/100`}
                                detail={item.evidence.status}
                              />

                              <StatCard
                                label="Verification"
                                value={
                                  item.verification
                                      .status ===
                                    "verified"
                                      ? "Verified"
                                      : item.verification
                                            .status ===
                                          "partially-verified"
                                        ? "Partial"
                                        : "Unverified"
                                }
                                detail="Signal status"
                              />

                              <StatCard
                                label="Workflow"
                                value={
                                  item.readiness ===
                                  "outreach-ready"
                                    ? "Outreach review"
                                    : item.readiness ===
                                        "needs-verification"
                                      ? "Verify first"
                                      : "Research"
                                }
                                detail="Next stage"
                              />
                            </div>

                            {item.evidence
                                .limitations.length >
                              0 && (
                              <div className="mt-5 rounded-2xl border border-amber-500/15 bg-amber-500/6 p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                                  Evidence gaps
                                </p>

                                <div className="mt-2 space-y-1">
                                  {item.evidence.limitations.map(
                                    (limitation) => (
                                      <p
                                        key={limitation}
                                        className="text-xs leading-5 text-slate-400"
                                      >
                                        {limitation}
                                      </p>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="mt-5 border-t border-white/6 pt-4">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                                Evidence → action
                              </p>

                              <p className="mt-2 text-sm leading-6 text-slate-300">
                                {item.intelligence
                                  .nextAction}
                              </p>
                            </div>

                            {item.buyer.companyLink && (
                              <a
                                href={
                                  item.buyer.companyLink
                                }
                                target="_blank"
                                rel="noreferrer noopener"
                                className="mt-5 inline-flex text-sm font-semibold text-blue-300 transition hover:text-blue-200"
                              >
                                Open company record →
                              </a>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No buyer records returned"
                        text="The configured provider returned no company records for this market."
                      />
                    )}
                  </div>
                )}
            </section>

            <div className="mt-6 rounded-3xl border border-white/6 bg-white/[0.018] p-5">
              <p className="text-xs font-semibold text-slate-500">
                Current MVP boundary
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Market intelligence is based on real UN Comtrade trade data.
                Buyer discovery is provider-dependent, with a free manual
                research fallback. Competition, pricing, logistics, market
                access, and final commercial viability are deliberately not
                inferred from import volume alone.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">
            Product Engine
          </div>

          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            From market discovery to the next sales action.
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-500">
            The product is intentionally built around a chain of evidence,
            not a black-box score: discover, validate, then act.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Feature
            number="01"
            title="Market Intelligence"
            text="Measure real import demand, growth, and data quality across international markets."
          />

          <Feature
            number="02"
            title="Buyer Intelligence"
            text="Connect market demand to companies that can be independently investigated and verified."
          />

          <Feature
            number="03"
            title="Opportunity Engine"
            text="Expose the signal, the missing evidence, and the next validation action instead of hiding the reasoning."
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="rounded-[30px] border border-blue-500/10 bg-gradient-to-br from-blue-950/35 via-blue-950/10 to-transparent p-7 sm:p-10">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">
              Core principle
            </div>

            <h2 className="mt-4 text-3xl font-bold tracking-tight">
              No evidence → no evidence strength.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">
              A useful export signal should always answer three things:
              what happened, how strong the evidence is, and what should be
              validated next.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Principle
                title="Evidence"
                text="What happened?"
              />
              <Principle
                title="Strength"
                text="How reliable is it?"
              />
              <Principle
                title="Action"
                text="What should happen next?"
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Export Command Center</span>
          <span>Evidence-driven export intelligence</span>
        </div>
      </footer>
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  emphasis,
}: {
  label: string;
  value: string;
  detail: string;
  emphasis?: "blue";
}) {
  return (
    <div className="rounded-2xl border border-white/7 bg-white/[0.02] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${
          emphasis === "blue"
            ? "text-blue-300"
            : "text-white"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-600">
        {detail}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="rounded-2xl bg-[#0c1220] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold text-slate-100">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-slate-600">
        {detail}
      </p>
    </div>
  );
}

function ExplainCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-[#080d17] p-4">
      <div className="text-xs font-bold text-blue-300">
        {number}
      </div>

      <div className="mt-3 text-sm font-semibold text-white">
        {title}
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-600">
        {text}
      </p>
    </div>
  );
}

function ResearchStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-[#080d17] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-300">
        {number} · {title}
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {text}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="mt-7 rounded-3xl border border-dashed border-white/9 bg-white/[0.015] p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-slate-600">
        →
      </div>

      <p className="mt-4 text-sm font-semibold text-white">
        {title}
      </p>

      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-600">
        {text}
      </p>
    </div>
  );
}

function Feature({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-3xl border border-white/7 bg-white/[0.02] p-6 transition hover:border-blue-500/15">
      <div className="text-sm font-bold text-blue-300">
        {number}
      </div>

      <h3 className="mt-5 text-xl font-semibold">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {text}
      </p>
    </article>
  );
}

function Principle({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
      <div className="text-sm font-semibold text-slate-200">
        {title}
      </div>

      <div className="mt-1 text-xs text-slate-600">
        {text}
      </div>
    </div>
  );
}
