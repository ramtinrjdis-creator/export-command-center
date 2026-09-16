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
  originExportStatus: "recorded" | "no_record" | "unavailable" | null;
  originShare: number | null;
  intelligence: {
    evidenceScore: number;
    evidenceLabel: "High" | "Medium" | "Low";
    evidenceStatus: "strong" | "moderate" | "limited" | "unavailable";
    decisionSignal: "promising" | "watch" | "insufficient-evidence";
    marketPriority: "priority" | "monitor" | "research";
    decisionLabel: string;
    nextAction: string;
    evidence: {
      key: string;
      label: string;
      value: string;
      status: "strong" | "moderate" | "limited" | "unavailable";
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
  evidenceStatus: "strong" | "moderate" | "limited";
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
    signal: "high-signal" | "medium-signal" | "low-signal" | "insufficient-evidence";
    signalScore: number;
    reasons: string[];
    nextAction: string;
  };
  evidence: {
    status: "strong" | "moderate" | "limited" | "unavailable";
    score: number;
    signals: string[];
    limitations: string[];
  };
  verification: {
    status: "verified" | "partially-verified" | "unverified";
    score: number;
    verifiedSignals: string[];
    missingSignals: string[];
  };
  readiness: "outreach-ready" | "needs-verification" | "research";
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

export default function Home() {
  const [product, setProduct] = useState("");
  const [origin, setOrigin] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [year, setYear] = useState("2024");

  const [loading, setLoading] = useState(false);

  const priorityRank = {
    priority: 0,
    monitor: 1,
    research: 2,
  } as const;
  const [searched, setSearched] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [buyers, setBuyers] = useState<BuyerAnalysis[]>([]);
  const [buyerSummary, setBuyerSummary] = useState<BuyerSummary | null>(null);
  const [buyerProvider, setBuyerProvider] = useState("");
  const [buyerLoading, setBuyerLoading] = useState(false);
  const [buyerError, setBuyerError] = useState("");
  const [buyerUnavailable, setBuyerUnavailable] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!product.trim() || !origin.trim() || !hsCode.trim()) return;

    setLoading(true);
    setSearched(false);
    setError("");
    setMarkets([]);

    try {
      const response = await fetch(
        `/api/analyze?hsCode=${encodeURIComponent(
          hsCode.trim()
        )}&year=${encodeURIComponent(
          year
        )}&origin=${encodeURIComponent(origin.trim())}`
      );

      const data: AnalysisResponse = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Analysis failed.");
      }

      setMarkets(data.markets || []);
      setSearched(true);
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

  async function loadBuyers(market: Market) {
    setSelectedMarket(market);
    setBuyers([]);
    setBuyerSummary(null);
    setBuyerProvider("");
    setBuyerError("");
    setBuyerUnavailable(false);
    setBuyerLoading(true);

    try {
      const params = new URLSearchParams({
        hsCode,
        market: String(market.countryCode),
        productDescription: product,
        limit: "10",
      });

      const response = await fetch(`/api/buyers?${params.toString()}`, {
        cache: "no-store",
      });

      const data = (await response.json()) as BuyerResponse;

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
      setBuyerUnavailable(!data.available);

      if (!data.available && data.limitations?.length) {
        setBuyerError(data.limitations[0]);
      }
    } catch (err) {
      setBuyerError(
        err instanceof Error ? err.message : "Buyer search failed."
      );
      setBuyerUnavailable(true);
    } finally {
      setBuyerLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800/80 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <div className="text-lg font-bold tracking-tight">
              Export Command Center
            </div>
            <div className="text-xs text-slate-500">
              Evidence-driven export intelligence
            </div>
          </div>

          <div className="hidden items-center gap-6 text-sm text-slate-400 sm:flex">
            <span>Markets</span>
            <span>Buyers</span>
            <span>Evidence</span>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
              MVP
            </span>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.16),transparent_42%)]" />

        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
              Export Intelligence
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Find where your product
              <span className="block text-blue-400">
                can actually win.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Discover promising export markets using real international
              trade data, then turn evidence into your next sales action.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-12 max-w-5xl rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7"
          >
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
              <div>
                <label
                  htmlFor="product"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Product
                </label>

                <input
                  id="product"
                  value={product}
                  onChange={(event) => setProduct(event.target.value)}
                  placeholder="e.g. Coffee"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label
                  htmlFor="hsCode"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  HS Code
                </label>

                <input
                  id="hsCode"
                  value={hsCode}
                  onChange={(event) =>
                    setHsCode(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="e.g. 090111"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label
                  htmlFor="origin"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Export Origin
                </label>

                <input
                  id="origin"
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                  placeholder="e.g. Iran"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  !product.trim() ||
                  !origin.trim() ||
                  !hsCode.trim()
                }
                className="rounded-xl bg-blue-600 px-6 py-3.5 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Find Markets"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              <span>✓ Real trade data</span>
              <span>✓ Market demand</span>
              <span>✓ Evidence</span>
              <span>✓ Transparent signals</span>
            </div>
          </form>
        </div>
      </section>

      {error && (
        <section className="border-y border-red-900/40 bg-red-950/20">
          <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
            <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-5">
              <p className="font-semibold text-red-300">
                Analysis failed
              </p>
              <p className="mt-2 text-sm text-red-400">{error}</p>
            </div>
          </div>
        </section>
      )}

      {searched && (
        <section className="border-y border-slate-800 bg-slate-900/40">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
                  Live Trade Analysis
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  Import markets for {product}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Origin: {origin} · HS {hsCode} · {year}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">
                {markets.length} markets found
              </div>
            </div>

            {markets.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center">
                <p className="font-semibold">No trade records found.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Try another HS code or year.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {markets.slice(0, 12).map((market) => (
                  <article
                    key={market.countryCode}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold">
                          {market.country}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Import demand signal
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-3xl font-bold text-blue-400">
                          {market.demandScore}
                        </div>

                        <div className="text-[10px] uppercase tracking-wider text-slate-600">
                          Index
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width: `${market.demandScore}%`,
                        }}
                      />
                    </div>

                    <div className="mt-6 rounded-xl bg-slate-900 p-4">
                      <div className="text-xs text-slate-500">
                        Import value
                      </div>

                      <div className="mt-1 text-xl font-semibold">
                        {formatImportValue(market.importValue)}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-900 p-3">
                        <div className="text-xs text-slate-500">
                          YoY growth
                        </div>

                        <div className="mt-1 text-sm font-semibold">
                          {market.growthRate === null
                            ? "—"
                            : `${market.growthRate > 0 ? "+" : ""}${market.growthRate}%`}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {market.trend}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-900 p-3">
                        <div className="text-xs text-slate-500">
                          Data status
                        </div>

                        <div className="mt-1 text-sm font-semibold">
                          {market.isEstimated
                            ? "Estimated"
                            : "Reported"}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-900 p-3">
                        <div className="text-xs text-slate-500">
                          Evidence Strength
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {market.intelligence.evidenceScore}/100
                          </span>

                          <span className="text-[10px] uppercase tracking-wider text-slate-500">
                            {market.intelligence.evidenceLabel}
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                          Evidence: {market.intelligence.evidenceStatus}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-900 p-3">
                        <div className="text-xs text-slate-500">
                          Quantity
                        </div>

                        <div className="mt-1 text-sm font-semibold">
                          {market.quantity > 0
                            ? Math.round(
                                market.quantity
                              ).toLocaleString()
                            : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Evidence
                      </div>

                      <div className="mt-3 space-y-2">
                        {market.intelligence.evidence.map((item) => (
                          <div key={item.key} className="flex items-start justify-between gap-3 text-xs">
                            <span className="text-slate-400">{item.label}</span>
                            <span className="text-right font-medium text-slate-200">{item.value}</span>
                          </div>
                        ))}
                      </div>

                      {market.intelligence.limitations.length > 0 && (
                        <div className="mt-3 border-t border-slate-800 pt-3 text-xs leading-5 text-amber-300">
                          {market.intelligence.limitations[0]}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
                      <span className="text-xs text-slate-500">
                        UN Comtrade
                      </span>

                      <span className="text-xs text-blue-400">
                        Evidence available
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadBuyers(market)}
                      disabled={buyerLoading}
                      className="mt-5 w-full rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {buyerLoading && selectedMarket?.countryCode === market.countryCode
                        ? "Finding buyers..."
                        : "Find Buyers →"}
                    </button>

                  </article>
                ))}
              </div>
            )}

            <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-950/70 p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
                    Buyer Intelligence
                  </p>

                  <h3 className="mt-2 text-2xl font-bold tracking-tight">
                    Find buyers for the selected market.
                  </h3>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    Buyer discovery runs only for the market you select,
                    so provider credits are not consumed across every market.
                  </p>
                </div>

                {selectedMarket && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
                    <span className="text-slate-500">Selected market:</span>{" "}
                    <span className="font-semibold text-white">
                      {selectedMarket.country}
                    </span>
                  </div>
                )}
              </div>

              {!selectedMarket && !buyerLoading && (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-6 text-center">
                  <p className="text-sm text-slate-400">
                    Select <span className="font-semibold text-blue-300">Find Buyers</span>
                    on any market above to start buyer discovery.
                  </p>
                </div>
              )}

              {buyerLoading && (
                <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 text-center">
                  <p className="text-sm font-medium text-blue-300">
                    Finding buyers and evaluating evidence...
                  </p>
                </div>
              )}

              {!buyerLoading && buyerError && (
                <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                  <p className="text-sm font-semibold text-amber-300">
                    Buyer discovery unavailable
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {buyerError}
                  </p>
                </div>
              )}

              {!buyerLoading && !buyerError && selectedMarket && buyerSummary && (
                <>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Signal title="Buyers" value={String(buyerSummary.total)} />
                    <Signal title="High signal" value={String(buyerSummary.highSignal)} />
                    <Signal title="Verified" value={String(buyerSummary.verified)} />
                    <Signal title="Needs verification" value={String(buyerSummary.partiallyVerified)} />
                  </div>

                  {buyerProvider && (
                    <p className="mt-4 text-xs text-slate-600">
                      Source provider: {buyerProvider}
                    </p>
                  )}

                  {buyers.length > 0 ? (
                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                      {buyers.map((item) => (
                        <article
                          key={item.buyer.id}
                          className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4 className="font-semibold text-white">
                                {item.buyer.companyName}
                              </h4>

                              <p className="mt-1 text-xs text-slate-500">
                                {item.buyer.country ?? "Unknown country"}
                              </p>
                            </div>

                            <span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                              {item.intelligence.signal}
                            </span>
                          </div>

                          <div className="mt-5 grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-slate-950 p-3">
                              <p className="text-xs text-slate-500">
                                Matched shipments
                              </p>
                              <p className="mt-1 text-lg font-semibold">
                                {item.buyer.matchingShipments ?? "—"}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-950 p-3">
                              <p className="text-xs text-slate-500">
                                Evidence
                              </p>
                              <p className="mt-1 text-lg font-semibold">
                                {item.evidence.score}/100
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-950 p-3">
                              <p className="text-xs text-slate-500">
                                Verification
                              </p>
                              <p className="mt-1 text-sm font-semibold">
                                {item.verification.status}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-950 p-3">
                              <p className="text-xs text-slate-500">
                                Readiness
                              </p>
                              <p className="mt-1 text-sm font-semibold">
                                {item.readiness}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 border-t border-slate-800 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Next action
                            </p>

                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              {item.intelligence.nextAction}
                            </p>
                          </div>

                          {item.buyer.companyLink && (
                            <a
                              href={item.buyer.companyLink}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-5 inline-flex text-sm font-semibold text-blue-400 hover:text-blue-300"
                            >
                              Open company record →
                            </a>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-6 text-center">
                      <p className="text-sm text-slate-400">
                        The provider returned no buyer records for this market.
                      </p>
                    </div>
                  )}
                </>
              )}
            </section>

            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex gap-3">
                <span className="mt-0.5 text-amber-400">!</span>

                <div>
                  <p className="font-semibold text-amber-300">
                    Current MVP scope
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    This MVP combines real UN Comtrade market intelligence
                    with a separate buyer discovery layer. Live buyer data
                    requires a configured provider. Competition, market
                    access, and final opportunity scoring remain future
                    evidence layers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
            Product Engine
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            From market discovery to the next sales action.
          </h2>

          <p className="mt-4 leading-7 text-slate-400">
            The product is designed around a simple principle: every
            recommendation should connect evidence to a business action.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Feature
            number="01"
            title="Market Intelligence"
            text="Measure real import activity and identify markets with strong demand signals."
          />

          <Feature
            number="02"
            title="Buyer Intelligence"
            text="Identify companies and buyer profiles that have a credible reason to purchase."
          />

          <Feature
            number="03"
            title="Opportunity Engine"
            text="Combine multiple verified signals into a transparent priority score and next sales action."
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="rounded-3xl border border-blue-900/50 bg-blue-950/20 p-7 sm:p-10">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
              Core Principle
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              No Evidence → No Evidence Strength.
            </h2>

            <p className="mt-4 leading-7 text-slate-400">
              A market score is only useful when the user can understand
              why the opportunity exists, what evidence supports it,
              and what action should happen next.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Signal title="Evidence" value="What happened?" />
              <Signal title="Evidence Strength" value="How strong is it?" />
              <Signal title="Action" value="What should I do?" />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Export Command Center</span>
          <span>Evidence-driven export intelligence</span>
        </div>
      </footer>
    </main>
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
    <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="text-sm font-bold text-blue-400">{number}</div>
      <h3 className="mt-5 text-xl font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
    </article>
  );
}

function Signal({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{value}</div>
    </div>
  );
}
