import { NextResponse } from "next/server";
import { buildMarketIntelligence } from "@/lib/intelligence";
import { calculateOriginShare } from "@/lib/analysis-math";
import { scoreMarket } from "@/lib/market-scoring";
import { buildDecisionProfile } from "@/lib/decision-engine";
import { buildNextBestResearch } from "@/lib/research-engine";
import { buildDataTrust } from "@/lib/trust-layer";
import { buildMarketAccess } from "@/lib/market-access";
import { buildCommercialReadiness } from "@/lib/commercial-readiness";
import {
  buildCompetitionContext,
  buildMarketAccessContext,
} from "@/lib/context/market-context";

const COMTRADE_BASE = "https://comtradeapi.un.org/public/v1/preview/C/A/HS";
const WORLD_BANK_BASE = "https://api.worldbank.org/v2";

const WORLD_BANK_TIMEOUT_MS = 10_000;

type TradeMarket = {
  countryCode: number;
  country: string;
  iso3: string | null;
  importValue: number;
  quantity: number | null;
  unit: string | null;
  isReported: boolean | null;
  isEstimated: boolean;
  isQuantityEstimated: boolean;
  reporterCode?: number | string;
};

type Macro = {
  population: number | null;
  gdpPerCapita: number | null;
};

function getTrend(growthRate: number | null) {
  if (growthRate === null) return "Insufficient data";
  if (growthRate >= 10) return "Strong growth";
  if (growthRate >= 3) return "Growing";
  if (growthRate > -3) return "Stable";
  if (growthRate > -10) return "Declining";
  return "Strong decline";
}

type ComtradeRecord = {
  reporterCode?: number | string;
  reporterDesc?: string | null;
  reporterDescEn?: string | null;
  reporterISO?: string | null;
  reporterIso?: string | null;
  primaryValue?: number | string | null;
  netWgt?: number | string | null;
  qty?: number | string | null;
  qtyUnitAbbr?: string | null;
  netWgtUnitAbbr?: string | null;
  isReported?: boolean | null;
  isQtyEstimated?: boolean | null;
  legacyEstimationFlag?: number | string | null;
  partnerCode?: number | string | null;
};

async function fetchYear(
  hsCode: string,
  year: string,
  reporterCode?: number,
  partnerCode = 0,
  flowCode = "M"
): Promise<TradeMarket[]> {
  const url = new URL(COMTRADE_BASE);
  url.searchParams.set("cmdCode", hsCode);
  url.searchParams.set("flowCode", flowCode);
  url.searchParams.set("partnerCode", String(partnerCode));
  url.searchParams.set("partner2Code", "0");
  url.searchParams.set("period", year);
  url.searchParams.set("motCode", "0");
  url.searchParams.set("customsCode", "C00");
  url.searchParams.set("maxRecords", "500");
  url.searchParams.set("includeDesc", "true");
  if (reporterCode !== undefined) {
    url.searchParams.set("reporterCode", String(reporterCode));
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Comtrade returned ${response.status}`);
  }

  const data = (await response.json()) as { data?: unknown[] };
  const records = Array.isArray(data.data)
    ? (data.data as ComtradeRecord[])
    : [];

  return records
    .filter((item: ComtradeRecord) => item?.reporterCode && Number(item?.primaryValue || 0) > 0)
    .map((item: ComtradeRecord) => ({
      countryCode: Number(item.reporterCode),
      country:
        typeof item.reporterDesc === "string" && item.reporterDesc.trim()
          ? item.reporterDesc.trim()
          : `Market ${Number(item.reporterCode)}`,
      iso3:
        typeof item.reporterISO === "string"
          ? item.reporterISO.trim().toUpperCase()
          : typeof item.reporterIso === "string"
            ? item.reporterIso.trim().toUpperCase()
            : null,
      importValue: Number(item.primaryValue || 0),
      quantity:
        item.netWgt != null && Number(item.netWgt) > 0
          ? Number(item.netWgt)
          : item.qty != null && Number(item.qty) > 0
            ? Number(item.qty)
            : null,
      unit: item.netWgtUnitAbbr || item.qtyUnitAbbr || null,
      isReported:
        typeof item.isReported === "boolean" ? item.isReported : null,
      isEstimated:
        Boolean(item.isQtyEstimated) || Number(item.legacyEstimationFlag || 0) !== 0,
      isQuantityEstimated:
        Boolean(item.isQtyEstimated) || Number(item.legacyEstimationFlag || 0) === 2,
    }));
}

async function fetchOriginImports(
  hsCode: string,
  year: string,
  originCode: number,
): Promise<TradeMarket[]> {
  const url = new URL(COMTRADE_BASE);

  // Explicitly request destination imports where the selected
  // origin is the trade partner. This matches the verified
  // direct Comtrade query used during runtime validation.
  url.searchParams.set("cmdCode", hsCode);
  url.searchParams.set("flowCode", "M");
  url.searchParams.set("partnerCode", String(originCode));
  url.searchParams.set("partner2Code", "0");
  url.searchParams.set("period", year);
  url.searchParams.set("motCode", "0");
  url.searchParams.set("customsCode", "C00");
  url.searchParams.set("maxRecords", "500");
  url.searchParams.set("includeDesc", "true");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Comtrade origin lookup returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: unknown[];
  };

  const records = Array.isArray(payload.data)
    ? (payload.data as ComtradeRecord[])
    : [];

  return records
    .filter(
      (item) =>
        item?.reporterCode !== undefined &&
        Number(item?.primaryValue ?? 0) > 0,
    )
    .map((item) => {
      const countryCode = Number(item.reporterCode);

      return {
        countryCode,
        country:
          typeof item.reporterDesc === "string" && item.reporterDesc.trim()
            ? item.reporterDesc.trim()
            : `Market ${countryCode}`,
        iso3:
          typeof item.reporterISO === "string"
            ? item.reporterISO.trim().toUpperCase()
            : typeof item.reporterIso === "string"
              ? item.reporterIso.trim().toUpperCase()
              : null,
        importValue: Number(item.primaryValue ?? 0),
        quantity:
          item.netWgt != null && Number(item.netWgt) > 0
            ? Number(item.netWgt)
            : item.qty != null && Number(item.qty) > 0
              ? Number(item.qty)
              : null,
        unit: item.netWgtUnitAbbr || item.qtyUnitAbbr || null,
        isReported:
          typeof item.isReported === "boolean" ? item.isReported : null,
        isEstimated:
          Boolean(item.isQtyEstimated) ||
          Number(item.legacyEstimationFlag || 0) !== 0,
        isQuantityEstimated:
          Boolean(item.isQtyEstimated) ||
          Number(item.legacyEstimationFlag || 0) === 2,
      };
    });
}

async function fetchWorldBankMacro(
  markets: TradeMarket[],
  year: number
): Promise<Map<string, Macro>> {
  const iso3s = Array.from(
    new Set(
      markets
        .map((market) => market.iso3)
        .filter((value): value is string => Boolean(value))
    )
  );

  if (!iso3s.length) return new Map();

  const indicators = ["SP.POP.TOTL", "NY.GDP.PCAP.CD"] as const;

  const results = await Promise.all(
    indicators.map(async (indicator) => {
      const url = new URL(
        `${WORLD_BANK_BASE}/country/${iso3s.join(";")}/indicator/${indicator}`
      );

      url.searchParams.set("date", String(year));
      url.searchParams.set("format", "json");
      url.searchParams.set("per_page", "5000");

      try {
        const response = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(WORLD_BANK_TIMEOUT_MS),
        });

        if (!response.ok) return [];

        const data = await response.json();
        return Array.isArray(data?.[1]) ? data[1] : [];
      } catch {
        return [];
      }
    })
  );

  const map = new Map<string, Macro>();

  for (let index = 0; index < results.length; index++) {
    const indicator = indicators[index];
    const rows = results[index];

    for (const row of rows) {
      const iso = String(row?.countryiso3code || "").toUpperCase();
      if (!iso) continue;

      const value = row?.value == null ? null : Number(row.value);
      const current = map.get(iso) || {
        population: null,
        gdpPerCapita: null,
      };

      if (indicator === "SP.POP.TOTL") {
        current.population = value;
      } else {
        current.gdpPerCapita = value;
      }

      map.set(iso, current);
    }
  }

  return map;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hsCode = searchParams.get("hsCode")?.trim() || "";
  const yearParam = searchParams.get("year")?.trim() || "2025";
  const originParam = searchParams.get("origin")?.trim() || "";
  const year = Number(yearParam);
  const origin = originParam ? Number(originParam) : null;

  if (!/^\d{2,6}$/.test(hsCode)) {
    return NextResponse.json({ ok: false, error: "A valid HS code is required (2 to 6 digits)." }, { status: 400 });
  }

  if (!Number.isInteger(year) || year < 2010 || year > 2026) {
    return NextResponse.json({ ok: false, error: "Year must be between 2010 and 2026." }, { status: 400 });
  }

  if (originParam && (!Number.isInteger(origin) || (origin as number) < 1)) {
    return NextResponse.json({ ok: false, error: "Origin must be a valid country code." }, { status: 400 });
  }

  const fetchedAt = new Date().toISOString();

  try {
    const years = [year, year - 1, year - 2, year - 3];
    const [current, previous, twoBack, threeBack] = await Promise.all(
      years.map((value) => fetchYear(hsCode, String(value)))
    );

    const previousMap = new Map(previous.map((market) => [market.countryCode, market.importValue]));
    const twoBackMap = new Map(twoBack.map((market) => [market.countryCode, market.importValue]));
    const threeBackMap = new Map(threeBack.map((market) => [market.countryCode, market.importValue]));

    const candidates = current.sort((a, b) => b.importValue - a.importValue).slice(0, 20);
    const maxImport = candidates[0]?.importValue || 0;

    const macroMap = await fetchWorldBankMacro(candidates, year);
    const originStatusMap = new Map<
  number,
  "recorded" | "no_record" | "unavailable" | "data_unavailable"
>();
    const originValueMap = new Map<number, number | null>();

    if (origin !== null) {
      try {
        const originRows = await fetchOriginImports(
          hsCode,
          String(year),
          origin as number
        );

        const originMap = new Map<number, number>();

        for (const row of originRows) {
          const code = Number(row.countryCode);
          const value = Number(row.importValue);

          if (Number.isInteger(code) && value > 0) {
            originMap.set(code, value);
          }
        }

        for (const market of candidates) {
          const code = Number(market.countryCode);

          if (originMap.has(code)) {
            originValueMap.set(code, originMap.get(code) ?? null);
            originStatusMap.set(code, "recorded");
          } else {
            originValueMap.set(code, null);
            originStatusMap.set(code, "no_record");
          }
        }
      } catch (error) {
        console.error("Origin batch lookup failed:", error);

        for (const market of candidates) {
          const code = Number(market.countryCode);
          originValueMap.set(code, null);
          originStatusMap.set(code, "unavailable");
        }
      }
    }

    const markets = candidates
      .map((market) => {
        const previousValue = previousMap.get(market.countryCode) ?? null;
        const twoBackValue = twoBackMap.get(market.countryCode) ?? null;
        const threeBackValue = threeBackMap.get(market.countryCode) ?? null;

        const growthRate =
          previousValue !== null && previousValue > 0
            ? Number((((market.importValue - previousValue) / previousValue) * 100).toFixed(1))
            : null;

        const cagr3y =
          threeBackValue !== null && threeBackValue > 0
            ? Number(((Math.pow(market.importValue / threeBackValue, 1 / 3) - 1) * 100).toFixed(1))
            : null;

        const periods = [
          [twoBackValue, previousValue],
          [previousValue, market.importValue],
        ].map(([from, to]) => (from && from > 0 && to != null ? ((to - from) / from) * 100 : null));
        const validPeriods = periods.filter((value): value is number => value !== null);
        const growthConsistency = validPeriods.length
          ? validPeriods.filter((value) => value > 0).length / validPeriods.length
          : null;

        const demandScore = maxImport > 0
          ? Math.round((Math.log10(Math.max(market.importValue, 1)) / Math.log10(Math.max(maxImport, 1))) * 100)
          : 0;

        const originStatus =
          origin !== null
            ? originStatusMap.get(market.countryCode) ?? "data_unavailable"
            : null;
        const originValue = origin !== null ? originValueMap.get(market.countryCode) ?? null : null;
        const originShare = calculateOriginShare(
          originValue,
          market.importValue,
        );

        const intelligence = buildMarketIntelligence({
          importValue: market.importValue,
          previousImportValue: previousValue,
          growthRate,
          demandScore,
          isReported: market.isReported,
          isEstimated: market.isEstimated,
          isQuantityEstimated: market.isQuantityEstimated,
          originExportValue: originValue,
          originExportStatus: originStatus,
          originShare,
        });

        const macro = market.iso3 ? macroMap.get(market.iso3) ?? { population: null, gdpPerCapita: null } : { population: null, gdpPerCapita: null };
        const opportunity = scoreMarket({
          importValue: market.importValue,
          maxImportValue: maxImport,
          growthRate,
          cagr3y,
          growthConsistency,
          originStatus,
          evidenceScore: intelligence.evidenceScore,
          macro,
        });

        const competition = buildCompetitionContext({
          originStatus,
          originShare,
        });

        const dataTrust = buildDataTrust({
          source: "UN Comtrade Preview API",
          period: year,
          retrievedAt: fetchedAt,
          isReported: market.isReported,
          isEstimated: market.isEstimated,
          isQuantityEstimated: market.isQuantityEstimated,
          originRequested: origin !== null,
          originStatus,
        });

        const marketAccessContext = buildMarketAccessContext();

        const marketAccess = buildMarketAccess({
          marketName: market.country,
          providerConfigured: false,
        });

        const commercialReadiness = buildCommercialReadiness({
          evidenceScore: intelligence.evidenceScore,
          originStatus,
          buyerEvidenceEstablished: false,
          marketAccessStatus:
            ["connected", "verified"].includes(String(marketAccess.status))
              ? "partially-verified"
              : ["limited", "partial", "verification-required"].includes(
                    String(marketAccess.status),
                  )
                ? "verification-required"
                : "not-connected",
        });

        const enrichedMarket = {
          ...market,
          previousImportValue: previousValue,
          twoYearsAgoImportValue: twoBackValue,
          threeYearsAgoImportValue: threeBackValue,
          growthRate,
          yoyGrowth: growthRate,
          cagr3y,
          growthConsistency:
            growthConsistency === null
              ? null
              : Number(growthConsistency.toFixed(2)),
          trend: getTrend(growthRate),
          demandScore,
          originExportValue: originValue,
          originExportStatus: originStatus,
          originShare,
          macro,
          intelligence,
          opportunity: {
            score: opportunity.score,
            signal: opportunity.signal,
            rationale: opportunity.rationale,
            riskFlags: opportunity.riskFlags,
            components: {
              demand: opportunity.demandScore,
              growth: opportunity.growthScore,
              history: opportunity.historyScore,
              origin: opportunity.originScore,
            },
          },
          evidence: {
            demand: demandScore >= 50,
            growth: growthRate === null ? "unknown" : growthRate >= 0,
            origin: originStatus === null ? "not-checked" : originStatus,
            buyer: "unavailable",
          },
          dataTrust,
          marketAccess,
          commercialReadiness,
          competition,
        };

        const decision = buildDecisionProfile({
          ...enrichedMarket,
          marketAccess: marketAccessContext,
          competition,
        });

        const researchPlan = buildNextBestResearch({
          ...enrichedMarket,
          marketAccess: marketAccessContext,
        });

        return {
          ...enrichedMarket,
          decision,
          researchPlan,
        };
      })
      .sort((a, b) => (b.opportunity?.score ?? 0) - (a.opportunity?.score ?? 0));

    const strongCount = markets.filter((market) => market.opportunity?.signal === "strong-validation-target").length;
    const validationCount = markets.filter((market) => market.opportunity?.signal === "validation-target").length;

    return NextResponse.json({
      ok: true,
      meta: {
        source: "UN Comtrade Preview API",
        period: year,
        retrievedAt: fetchedAt,
        limitations: [
          "Destination import demand is distinct from origin-specific export evidence.",
          "Missing bilateral evidence is not interpreted as zero trade.",
          "Buyer, market-access and competitive claims require separate evidence layers.",
        ],
      },
      source: "UN Comtrade + World Bank",
      fetchedAt,
      year: String(year),
      previousYear: year - 1,
      hsCode,
      origin,
      markets,
      count: markets.length,
      screening: {
        globalMarketsReturned: current.length,
        screenedMarkets: candidates.length,
        originQueries: origin === null ? 0 : 1,
        originDataAvailability:
        origin === null
          ? "not-requested"
          : originStatusMap.size === 0
            ? "unavailable"
            : Array.from(originStatusMap.values()).every(
                (status) =>
                  status === "recorded" ||
                  status === "no_record"
              )
              ? "available"
              : "partial",

        strongSignals: strongCount,
        validationTargets: validationCount,
        methodology:
          "Markets use destination import demand, year-over-year growth, a 3-year trend, origin-specific bilateral checks, evidence coverage, and optional macro context. Missing evidence is never treated as zero trade.",
      },
      evidence: {
        sources: ["UN Comtrade", "World Bank World Development Indicators"],
        methodology:
          "Demand is based on reported destination import value; momentum uses YoY and 3-year CAGR/consistency; origin evidence is checked as destination imports from the selected origin; macro context is supplemental.",
        fetchedAt,
      },
    });
  } catch (error) {
    console.error("Trade analysis error:", error);
    return NextResponse.json(
        {
          ok: false,
          error: "Unable to retrieve trade data.",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 502 },
      );
  }
}
