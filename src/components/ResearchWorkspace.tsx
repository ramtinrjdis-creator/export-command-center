"use client";

import { useMemo, useState } from "react";

type WorkspaceMarket = {
  country?: string;
  market?: string;
  marketName?: string;
  countryCode?: string | number;
  importValue?: number | null;
  yoyGrowth?: number | null;
  growth?: number | null;
  demandScore?: number | null;
  originExportStatus?: string | null;
  originShare?: number | null;
  opportunity?: {
    score?: number | null;
    signal?: string | null;
  } | null;
  intelligence?: {
    evidenceScore?: number | null;
  } | null;
  decision?: {
    priority?: number | null;
    confidence?: number | null;
    confidenceLabel?: string | null;
  } | null;
};

type Props = {
  markets: WorkspaceMarket[];
  product: string;
  hsCode: string;
  origin: string;
  year: string;
};

const STORAGE_KEY = "ecc:workspace:saved-markets:v1";

function marketName(market: WorkspaceMarket) {
  return (
    market.country ||
    market.marketName ||
    market.market ||
    "Unknown market"
  );
}

function marketKey(market: WorkspaceMarket) {
  return String(
    market.countryCode ??
      marketName(market)
  );
}

function numberValue(value: number | null | undefined) {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export default function ResearchWorkspace({
  markets,
  product,
  hsCode,
  origin,
  year,
}: Props) {
  const [savedKeys, setSavedKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const raw =
        window.localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) return [];

      const parsed =
        JSON.parse(raw);

      return Array.isArray(parsed)
        ? parsed.filter(
            (item): item is string =>
              typeof item === "string"
          )
        : [];
    } catch {
      return [];
    }
  });

  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const savedMarkets = useMemo(
    () =>
      markets.filter((market) =>
        savedKeys.includes(
          marketKey(market)
        )
      ),
    [markets, savedKeys]
  );

  const compareMarkets = useMemo(
    () =>
      markets.filter((market) =>
        compareKeys.includes(
          marketKey(market)
        )
      ),
    [markets, compareKeys]
  );

  function persistSavedKeys(nextKeys: string[]) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(nextKeys)
      );
    } catch {
      // Local workspace persistence is optional.
    }
  }

  function toggleSaved(
    market: WorkspaceMarket
  ) {
    const key = marketKey(market);

    setSavedKeys((current) => {
      const nextKeys = current.includes(key)
        ? current.filter(
            (item) => item !== key
          )
        : [...current, key];

      persistSavedKeys(nextKeys);
      return nextKeys;
    });
  }

  function toggleCompare(
    market: WorkspaceMarket
  ) {
    const key = marketKey(market);

    setCompareKeys((current) => {
      if (current.includes(key)) {
        return current.filter(
          (item) => item !== key
        );
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, key];
    });
  }

  function clearWorkspace() {
    setSavedKeys([]);
    setCompareKeys([]);

    try {
      window.localStorage.removeItem(
        STORAGE_KEY
      );
    } catch {
      // Optional.
    }
  }

  function buildRows() {
    return savedMarkets.map(
      (market) => ({
        market: marketName(market),
        countryCode:
          market.countryCode ?? "",
        importValue:
          numberValue(
            market.importValue
          ),
        growth:
          numberValue(
            market.yoyGrowth ??
              market.growth
          ),
        demandScore:
          numberValue(
            market.demandScore
          ),
        opportunityScore:
          numberValue(
            market.opportunity?.score
          ),
        evidenceScore:
          numberValue(
            market.intelligence
              ?.evidenceScore
          ),
        confidence:
          numberValue(
            market.decision
              ?.confidence
          ),
        origin:
          market.originExportStatus ??
          "not-checked",
        originShare:
          numberValue(
            market.originShare
          ),
      })
    );
  }

  function download(
    filename: string,
    content: string,
    type: string
  ) {
    const blob =
      new Blob([content], {
        type,
      });

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const payload = {
      exportedAt:
        new Date().toISOString(),
      product,
      hsCode,
      origin,
      year,
      markets: buildRows(),
    };

    download(
      `ecc-${hsCode}-${year}-shortlist.json`,
      JSON.stringify(
        payload,
        null,
        2
      ),
      "application/json"
    );
  }

  function exportCsv() {
    const rows =
      buildRows();

    const header = [
      "Market",
      "Country Code",
      "Import Value",
      "YoY Growth",
      "Demand Score",
      "Opportunity Score",
      "Evidence Score",
      "Confidence",
      "Origin Status",
      "Origin Share",
    ];

    const lines = [
      header.join(","),
      ...rows.map(
        (row) =>
          [
            escapeCsv(
              row.market
            ),
            row.countryCode,
            row.importValue ?? "",
            row.growth ?? "",
            row.demandScore ?? "",
            row.opportunityScore ?? "",
            row.evidenceScore ?? "",
            row.confidence ?? "",
            escapeCsv(
              row.origin
            ),
            row.originShare ??
              "",
          ].join(",")
      ),
    ];

    download(
      `ecc-${hsCode}-${year}-shortlist.csv`,
      lines.join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  async function copyWorkspace() {
    const rows =
      buildRows();

    const text = [
      "Export Command Center — Research Workspace",
      `Product: ${product}`,
      `HS: ${hsCode}`,
      `Origin: ${origin}`,
      `Year: ${year}`,
      "",
      ...rows.map(
        (row, index) =>
          `${index + 1}. ${row.market} · Opportunity ${row.opportunityScore ?? "—"} · Evidence ${row.evidenceScore ?? "—"} · Growth ${row.growth == null ? "—" : `${row.growth > 0 ? "+" : ""}${row.growth}%`} · Origin ${row.origin}`
      ),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(
        text
      );

      setCopied(true);

      window.setTimeout(
        () => setCopied(false),
        1600
      );
    } catch {
      // Clipboard access is optional.
    }
  }

  if (!markets.length) {
    return null;
  }

  return (
    <section
      id="workspace-tools"
      className="scroll-mt-24 border-y border-white/[0.07] bg-white/[0.012]"
    >
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/65">
              Research workspace
            </div>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">
              Turn the scan into a working shortlist.
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/38">
              Save the markets that deserve attention, compare up to three,
              and export your working shortlist without leaving ECC.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!savedMarkets.length}
              className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 transition hover:bg-white/[0.05] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Export CSV
            </button>

            <button
              type="button"
              onClick={exportJson}
              disabled={!savedMarkets.length}
              className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 transition hover:bg-white/[0.05] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Export JSON
            </button>

            <button
              type="button"
              onClick={copyWorkspace}
              disabled={!savedMarkets.length}
              className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/65 transition hover:bg-cyan-300/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {copied
                ? "Copied"
                : "Copy Shortlist"}
            </button>

            <button
              type="button"
              onClick={clearWorkspace}
              disabled={
                !savedKeys.length &&
                !compareKeys.length
              }
              className="rounded-xl border border-white/6 bg-black/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30 transition hover:text-white/60 disabled:cursor-not-allowed disabled:opacity-20"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/7 bg-black/15 p-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
              Current scan
            </div>
            <div className="mt-2 text-2xl font-semibold text-white/80">
              {markets.length}
            </div>
            <div className="mt-1 text-[10px] text-white/25">
              markets available
            </div>
          </div>

          <div className="rounded-2xl border border-white/7 bg-black/15 p-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/20">
              Saved
            </div>
            <div className="mt-2 text-2xl font-semibold text-white/80">
              {savedKeys.length}
            </div>
            <div className="mt-1 text-[10px] text-white/25">
              persisted on this device
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.02] p-4">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-200/45">
              Compare
            </div>
            <div className="mt-2 text-2xl font-semibold text-white/80">
              {compareKeys.length}/3
            </div>
            <div className="mt-1 text-[10px] text-white/25">
              markets selected
            </div>
          </div>
        </div>

        <div className="mt-7 rounded-[28px] border border-white/7 bg-black/15 p-4 md:p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/20">
                Market shortlist
              </div>
              <div className="mt-1 text-xs text-white/30">
                Save markets for this device. Select up to three for side-by-side comparison.
              </div>
            </div>

            <div className="text-[10px] text-white/20">
              {product} · HS {hsCode} · {year}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {markets
              .slice(0, 12)
              .map((market) => {
                const key =
                  marketKey(market);

                const isSaved =
                  savedKeys.includes(
                    key
                  );

                const isCompared =
                  compareKeys.includes(
                    key
                  );

                const growth =
                  numberValue(
                    market.yoyGrowth ??
                      market.growth
                  );

                return (
                  <div
                    key={key}
                    className={`grid gap-3 rounded-2xl border p-3 md:grid-cols-[1.5fr_.6fr_.65fr_.7fr_.7fr_auto] md:items-center ${
                      isCompared
                        ? "border-cyan-300/15 bg-cyan-300/[0.035]"
                        : "border-white/6 bg-white/[0.012]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white/70">
                        {marketName(
                          market
                        )}
                      </div>

                      <div className="mt-1 text-[10px] text-white/20">
                        Origin{" "}
                        {market.originExportStatus ===
                        "recorded"
                          ? "recorded"
                          : market.originExportStatus ===
                              "no_record"
                            ? "no bilateral record"
                            : "not established"}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                        Opportunity
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        {market.opportunity?.score ??
                          "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                        Evidence
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        {market.intelligence?.evidenceScore ??
                          "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                        Growth
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        {growth == null
                          ? "—"
                          : `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-white/20">
                        Confidence
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        {market.decision?.confidence ??
                          "—"}
                      </div>
                    </div>

                    <div className="flex gap-2 md:justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          toggleSaved(
                            market
                          )
                        }
                        aria-label={
                          isSaved
                            ? `Remove ${marketName(market)} from saved markets`
                            : `Save ${marketName(market)}`
                        }
                        className={`rounded-xl border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition ${
                          isSaved
                            ? "border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200/80"
                            : "border-white/7 bg-white/[0.02] text-white/35 hover:text-white/65"
                        }`}
                      >
                        {isSaved
                          ? "Saved"
                          : "Save"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleCompare(
                            market
                          )
                        }
                        disabled={
                          !isCompared &&
                          compareKeys.length >=
                            3
                        }
                        aria-label={
                          isCompared
                            ? `Remove ${marketName(market)} from comparison`
                            : `Compare ${marketName(market)}`
                        }
                        className={`rounded-xl border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition ${
                          isCompared
                            ? "border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-100/80"
                            : "border-white/7 bg-white/[0.02] text-white/35 hover:text-white/65 disabled:opacity-20"
                        }`}
                      >
                        {isCompared
                          ? "Selected"
                          : "Compare"}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {savedMarkets.length > 0 ? (
          <div className="mt-7 rounded-[28px] border border-white/7 bg-black/15 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/20">
                  Saved shortlist
                </div>
                <div className="mt-1 text-xs text-white/30">
                  Your working set stays local to this browser.
                </div>
              </div>

              <div className="text-[10px] text-emerald-200/55">
                {savedMarkets.length} saved
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {savedMarkets.map(
                (market) => (
                  <span
                    key={marketKey(market)}
                    className="rounded-full border border-emerald-300/10 bg-emerald-300/[0.035] px-3 py-2 text-xs text-emerald-100/65"
                  >
                    {marketName(
                      market
                    )}
                  </span>
                )
              )}
            </div>
          </div>
        ) : null}

        {compareMarkets.length >= 2 ? (
          <div className="mt-7 overflow-x-auto rounded-[28px] border border-cyan-300/10 bg-cyan-300/[0.018] p-4 md:p-5">
            <div className="min-w-[760px]">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-200/50">
                Comparison workspace
              </div>

              <div className="mt-4 grid grid-cols-[1.2fr_repeat(3,1fr)] gap-3 border-b border-white/7 pb-3 text-[9px] uppercase tracking-[0.12em] text-white/20">
                <span>Metric</span>

                {compareMarkets.map(
                  (market) => (
                    <span
                      key={marketKey(
                        market
                      )}
                      className="truncate"
                    >
                      {marketName(
                        market
                      )}
                    </span>
                  )
                )}
              </div>

              {(
                [
                  {
                    label: "Opportunity",
                    value: (m: WorkspaceMarket) =>
                      m.opportunity?.score ?? "—",
                  },
                  {
                    label: "Evidence",
                    value: (m: WorkspaceMarket) =>
                      m.intelligence?.evidenceScore ?? "—",
                  },
                  {
                    label: "Confidence",
                    value: (m: WorkspaceMarket) =>
                      m.decision?.confidence ?? "—",
                  },
                  {
                    label: "Relative demand",
                    value: (m: WorkspaceMarket) =>
                      m.demandScore ?? "—",
                  },
                  {
                    label: "YoY growth",
                    value: (m: WorkspaceMarket) => {
                      const value =
                        numberValue(
                          m.yoyGrowth ?? m.growth
                        );

                      return value == null
                        ? "—"
                        : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
                    },
                  },
                  {
                    label: "Origin",
                    value: (m: WorkspaceMarket) =>
                      m.originExportStatus ===
                      "recorded"
                        ? "Recorded"
                        : m.originExportStatus ===
                            "no_record"
                          ? "No record"
                          : "Not established",
                  },
                ] as {
                  label: string;
                  value: (
                    market: WorkspaceMarket
                  ) => string | number;
                }[]
              ).map(({ label, value }) => (
                <div
                  key={label}
                  className="grid grid-cols-[1.2fr_repeat(3,1fr)] gap-3 border-b border-white/5 py-3 text-xs text-white/45"
                >
                  <span className="text-white/30">
                    {label}
                  </span>

                  {compareMarkets.map(
                    (market) => (
                      <span
                        key={`${label}-${marketKey(
                          market
                        )}`}
                        className="font-medium text-white/65"
                      >
                        {String(
                          value(market)
                        )}
                      </span>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-7 rounded-2xl border border-white/6 bg-black/10 p-4 text-xs leading-6 text-white/28">
            Select two or three markets above to open the comparison workspace.
          </div>
        )}
      </div>
    </section>
  );
}
