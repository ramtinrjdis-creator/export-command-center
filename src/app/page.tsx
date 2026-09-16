"use client";

import { FormEvent, useState } from "react";

type Market = {
  country: string;
  demand: string;
  competition: string;
  opportunity: number;
  reason: string;
};

const demoMarkets: Market[] = [
  {
    country: "United Arab Emirates",
    demand: "High",
    competition: "Medium",
    opportunity: 91,
    reason: "Strong import activity, regional distribution potential, and relatively accessible B2B market.",
  },
  {
    country: "Saudi Arabia",
    demand: "High",
    competition: "Medium",
    opportunity: 87,
    reason: "Large industrial demand with established import channels and expanding infrastructure.",
  },
  {
    country: "Turkey",
    demand: "High",
    competition: "High",
    opportunity: 78,
    reason: "Large industrial market, but stronger local and regional competition requires sharper positioning.",
  },
];

export default function Home() {
  const [product, setProduct] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!product.trim() || !origin.trim()) return;

    setLoading(true);

    window.setTimeout(() => {
      setLoading(false);
      setSearched(true);
    }, 900);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Navigation */}
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

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.16),transparent_42%)]" />

        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
              Export Intelligence
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Find where your product
              <span className="block text-blue-400">can actually win.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Discover promising export markets, identify potential buyers,
              evaluate competition, and prioritize your next sales action
              using evidence instead of guesswork.
            </p>
          </div>

          {/* Search Card */}
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-12 max-w-4xl rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7"
          >
            <div className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
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
                  placeholder="e.g. Butterfly Valve"
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
                disabled={loading || !product.trim() || !origin.trim()}
                className="rounded-xl bg-blue-600 px-6 py-3.5 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Find Opportunities"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              <span>✓ Market demand</span>
              <span>✓ Competition signals</span>
              <span>✓ Buyer potential</span>
              <span>✓ Evidence-based scoring</span>
            </div>
          </form>
        </div>
      </section>

      {/* Results */}
      {searched && (
        <section className="border-y border-slate-800 bg-slate-900/40">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
                  Analysis Preview
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  Opportunities for {product}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Origin: {origin} · Demo intelligence layer
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">
                Analysis complete
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {demoMarkets.map((market) => (
                <article
                  key={market.country}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold">{market.country}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Market opportunity
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-400">
                        {market.opportunity}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-600">
                        Score
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${market.opportunity}%` }}
                    />
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-900 p-3">
                      <div className="text-xs text-slate-500">Demand</div>
                      <div className="mt-1 text-sm font-semibold">
                        {market.demand}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-900 p-3">
                      <div className="text-xs text-slate-500">Competition</div>
                      <div className="mt-1 text-sm font-semibold">
                        {market.competition}
                      </div>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-6 text-slate-400">
                    {market.reason}
                  </p>

                  <button
                    type="button"
                    className="mt-6 w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium transition hover:border-blue-500 hover:bg-blue-500/5"
                  >
                    View Evidence
                  </button>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex gap-3">
                <span className="mt-0.5 text-amber-400">!</span>
                <div>
                  <p className="font-semibold text-amber-300">
                    Demo intelligence
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    These results are currently simulated UI data. The next
                    product layer will replace them with real market,
                    trade, company, and buyer evidence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Product Architecture */}
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
            text="Measure demand, import activity, market conditions, competition, and recent signals."
          />

          <Feature
            number="02"
            title="Buyer Intelligence"
            text="Identify companies and buyer profiles that have a credible reason to purchase."
          />

          <Feature
            number="03"
            title="Opportunity Engine"
            text="Convert multiple signals into a transparent priority score and recommended next action."
          />
        </div>
      </section>

      {/* Evidence Principle */}
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <div className="rounded-3xl border border-blue-900/50 bg-blue-950/20 p-7 sm:p-10">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
              Core Principle
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              No Evidence → No Confidence.
            </h2>

            <p className="mt-4 leading-7 text-slate-400">
              A market score is only useful when the user can understand why
              the opportunity exists, what evidence supports it, and what
              action should happen next.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Signal title="Evidence" value="What happened?" />
              <Signal title="Confidence" value="How strong is it?" />
              <Signal title="Action" value="What should I do?" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
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

function Signal({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{value}</div>
    </div>
  );
}
