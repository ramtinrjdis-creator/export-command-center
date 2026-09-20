import { NextResponse } from "next/server";
import { buildMarketIntelligence } from "@/lib/intelligence";
import { buildOpportunitySignal } from "@/lib/opportunity";

const COMTRADE_BASE =
  "https://comtradeapi.un.org/public/v1/preview/C/A/HS";

const COMTRADE_AVAILABILITY_BASE =
  "https://comtradeapi.un.org/public/v1/getDA/C/A/HS";

const COMTRADE_TIMEOUT_MS = 10_000;

const COUNTRY_NAMES: Record<number, string> = {
  12: "Algeria",
  36: "Australia",
  40: "Austria",
  56: "Belgium",
  76: "Brazil",
  124: "Canada",
  156: "China",
  191: "Croatia",
  208: "Denmark",
  250: "France",
  251: "France",
  276: "Germany",
  356: "India",
  364: "Iran",
  380: "Italy",
  392: "Japan",
  410: "South Korea",
  458: "Malaysia",
  528: "Netherlands",
  554: "New Zealand",
  578: "Norway",
  616: "Poland",
  620: "Portugal",
  682: "Saudi Arabia",
  724: "Spain",
  752: "Sweden",
  757: "Switzerland",
  792: "Türkiye",
  826: "United Kingdom",
  842: "United States",
  860: "Uzbekistan",
};

const ORIGIN_CODES: Record<string, number> = {
  iran: 364,
  "islamic republic of iran": 364,
  usa: 842,
  "united states": 842,
  "united states of america": 842,
  germany: 276,
  france: 250,
  italy: 380,
  japan: 392,
  china: 156,
  india: 356,
  canada: 124,
  spain: 724,
  netherlands: 528,
  switzerland: 757,
  "united kingdom": 826,
  uk: 826,
  turkey: 792,
  turkiye: 792,
  türkiye: 792,
  "south korea": 410,
  korea: 410,
  australia: 36,
  belgium: 56,
  austria: 40,
  denmark: 208,
  sweden: 752,
  norway: 578,
  poland: 616,
  portugal: 620,
  algeria: 12,
  "saudi arabia": 682,
  malaysia: 458,
  "new zealand": 554,
  uzbekistan: 860,
};

type TradeMarket = {
  countryCode: number;
  country: string;
  importValue: number;
  quantity: number;
  unit: string | null;
  isReported: boolean;
  isEstimated: boolean;
};

type ComtradeRecord = {
  reporterCode?: number | string | null;
  primaryValue?: number | string | null;
  netWgt?: number | string | null;
  qty?: number | string | null;
  qtyUnitAbbr?: string | null;
  netWgtUnitAbbr?: string | null;
  isReported?: boolean | null;
  isQtyEstimated?: boolean | null;
  legacyEstimationFlag?: number | string | null;
};

function isComtradeRecord(value: unknown): value is ComtradeRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const reporterCode = record.reporterCode;
  const primaryValue = record.primaryValue;

  const validReporterCode =
    typeof reporterCode === "number" ||
    typeof reporterCode === "string";

  const validPrimaryValue =
    primaryValue === null ||
    primaryValue === undefined ||
    typeof primaryValue === "number" ||
    typeof primaryValue === "string";

  return validReporterCode && validPrimaryValue;
}

type BilateralExportResult =
  | {
      status: "recorded";
      value: number;
    }
  | {
      status: "no_record";
      value: null;
    }
  | {
      status: "rate_limited";
      value: null;
    }
  | {
      status: "data_unavailable";
      value: null;
    }
  | {
      status: "unavailable";
      value: null;
    };

type ScreenedMarket = TradeMarket & {
  previousImportValue: number | null;
  growthRate: number | null;
  demandScore: number;
  screeningReasons: string[];
};

function getTrend(growthRate: number | null) {
  if (growthRate === null) return "Insufficient data";
  if (growthRate >= 10) return "Strong growth";
  if (growthRate >= 3) return "Growing";
  if (growthRate > -3) return "Stable";
  if (growthRate > -10) return "Declining";
  return "Strong decline";
}

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

  if (reporterCode !== undefined) {
    url.searchParams.set(
      "reporterCode",
      String(reporterCode)
    );
  }

  url.searchParams.set("motCode", "0");
  url.searchParams.set("customsCode", "C00");
  url.searchParams.set("maxRecords", "500");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(COMTRADE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Comtrade returned ${response.status}`
    );
  }

  const data: unknown = await response.json();

  if (
    typeof data !== "object" ||
    data === null ||
    !("data" in data) ||
    !Array.isArray(data.data)
  ) {
    throw new Error("Unexpected Comtrade response format.");
  }

  const records = data.data.filter(isComtradeRecord);

  return records
    .filter(
      (item) =>
        item.reporterCode !== null &&
        item.reporterCode !== undefined &&
        Number(item.primaryValue ?? 0) > 0
    )
    .map((item) => ({
      countryCode: Number(item.reporterCode),
      country:
        COUNTRY_NAMES[Number(item.reporterCode)] ||
        `Market (code: ${Number(item.reporterCode)})`,
      importValue: Number(item.primaryValue ?? 0),
      quantity: Number(item.netWgt ?? item.qty ?? 0),
      unit:
        item.qtyUnitAbbr ||
        item.netWgtUnitAbbr ||
        null,
      isReported: Boolean(item.isReported),
      isEstimated:
        Boolean(item.isQtyEstimated) ||
        Number(item.legacyEstimationFlag ?? 0) !== 0,
    }));
}

async function fetchOriginDataAvailability(
  reporterCode: number,
  year: string
): Promise<"available" | "unavailable" | "unknown"> {
  const url = new URL(COMTRADE_AVAILABILITY_BASE);

  url.searchParams.set("reporterCode", String(reporterCode));
  url.searchParams.set("period", year);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(COMTRADE_TIMEOUT_MS),
    });

    if (!response.ok) {
      return "unknown";
    }

    const payload: unknown = await response.json();

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("data" in payload) ||
      !Array.isArray(payload.data)
    ) {
      return "unknown";
    }

    return payload.data.length > 0
      ? "available"
      : "unavailable";
  } catch {
    return "unknown";
  }
}

async function fetchBilateralExport(
  hsCode: string,
  year: string,
  reporterCode: number,
  partnerCode: number
): Promise<BilateralExportResult> {
  const url = new URL(COMTRADE_BASE);

  url.searchParams.set("cmdCode", hsCode);
  url.searchParams.set("flowCode", "X");
  url.searchParams.set(
    "reporterCode",
    String(reporterCode)
  );
  url.searchParams.set(
    "partnerCode",
    String(partnerCode)
  );
  url.searchParams.set("partner2Code", "0");
  url.searchParams.set("period", year);
  url.searchParams.set("motCode", "0");
  url.searchParams.set("customsCode", "C00");
  url.searchParams.set("maxRecords", "1");

  const maxAttempts = 2;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      const response = await fetch(
        url.toString(),
        {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(COMTRADE_TIMEOUT_MS),
        }
      );

      if (response.ok) {
        const data =
          await response.json();

        const record =
          Array.isArray(data?.data)
            ? data.data[0]
            : null;

        if (!record) {
          return {
            status: "no_record",
            value: null,
          };
        }

        const value = Number(
          record.primaryValue || 0
        );

        if (value <= 0) {
          return {
            status: "no_record",
            value: null,
          };
        }

        return {
          status: "recorded",
          value,
        };
      }

      if (response.status === 429) {
        if (attempt < maxAttempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, 3000)
          );
          continue;
        }

        return {
          status: "rate_limited",
          value: null,
        };
      }

      console.error(
        `Comtrade bilateral request returned ${response.status}: origin=${reporterCode}, market=${partnerCode}`
      );

      return {
        status: "unavailable",
        value: null,
      };
    } catch (error) {
      console.error(
        `Comtrade bilateral request failed: origin=${reporterCode}, market=${partnerCode}`,
        error
      );

      return {
        status: "unavailable",
        value: null,
      };
    }
  }

  return {
    status: "unavailable",
    value: null,
  };
}

/**
 * Market screening happens before bilateral origin queries.
 *
 * The rules below are transparent screening rules, not an
 * opportunity score:
 *
 * - positive import demand is required;
 * - meaningful demand OR meaningful growth is required;
 * - severe decline is excluded unless demand is exceptionally
 *   strong;
 * - origin market itself is excluded.
 *
 * A small candidate cap exists only to protect the public API
 * from excessive bilateral requests.
 */
function screenMarkets(
  currentMarkets: TradeMarket[],
  previousMarkets: TradeMarket[],
  originCode: number | null
): ScreenedMarket[] {
  const previousMap = new Map(
    previousMarkets.map((market) => [
      market.countryCode,
      market.importValue,
    ])
  );

  const maxImport =
    currentMarkets.length > 0
      ? Math.max(
          ...currentMarkets.map(
            (market) => market.importValue
          )
        )
      : 0;

  return currentMarkets
    .filter(
      (market) =>
        market.importValue > 0 &&
        market.countryCode !== originCode
    )
    .map((market) => {
      const previousValue =
        previousMap.get(
          market.countryCode
        ) ?? null;

      const growthRate =
        previousValue !== null &&
        previousValue > 0
          ? ((market.importValue -
              previousValue) /
              previousValue) *
            100
          : null;

      const demandScore =
        maxImport > 0
          ? Math.round(
              (market.importValue /
                maxImport) *
                100
            )
          : 0;

      const screeningReasons: string[] = [];

      if (demandScore >= 30) {
        screeningReasons.push(
          "Meaningful relative import demand."
        );
      }

      if (
        growthRate !== null &&
        growthRate >= 5
      ) {
        screeningReasons.push(
          "Positive year-over-year growth."
        );
      }

      if (
        growthRate !== null &&
        growthRate <= -10
      ) {
        screeningReasons.push(
          "Strong year-over-year decline."
        );
      }

      /*
       * Evidence-based screen:
       * keep markets with meaningful demand OR
       * meaningful positive growth.
       *
       * Strongly declining markets are excluded unless
       * their demand is exceptionally large.
       */
      const meaningfulDemand =
        demandScore >= 30;

      const meaningfulGrowth =
        growthRate !== null &&
        growthRate >= 5;

      const severeDecline =
        growthRate !== null &&
        growthRate <= -10;

      const keep =
        (meaningfulDemand ||
          meaningfulGrowth) &&
        (!severeDecline ||
          demandScore >= 80);

      return {
        ...market,
        previousImportValue:
          previousValue,
        growthRate:
          growthRate === null
            ? null
            : Number(
                growthRate.toFixed(1)
              ),
        demandScore,
        screeningReasons,
        keep,
      };
    })
    .reduce<ScreenedMarket[]>(
      (result, { keep, ...screenedMarket }) => {
        if (keep) {
          result.push(screenedMarket);
        }
        return result;
      },
      []
    )
    .sort((a, b) => {
      const growthA =
        a.growthRate ?? -100;
      const growthB =
        b.growthRate ?? -100;

      const demandDifference =
        b.demandScore -
        a.demandScore;

      if (demandDifference !== 0) {
        return demandDifference;
      }

      return growthB - growthA;
    })
    .slice(0, 8);
}

export async function GET(
  request: Request
) {
  const { searchParams } =
    new URL(request.url);

  const hsCode =
    searchParams.get("hsCode")?.trim();

  const year =
    searchParams.get("year")?.trim() ||
    "2024";

  const originParam =
    searchParams.get("origin")?.trim();

  let originCode: number | null =
    null;

  if (originParam) {
    const normalizedOrigin =
      originParam.toLowerCase();

    if (/^\d+$/.test(normalizedOrigin)) {
      const parsedOrigin =
        Number(normalizedOrigin);

      if (
        Number.isInteger(
          parsedOrigin
        ) &&
        parsedOrigin > 0
      ) {
        originCode = parsedOrigin;
      }
    } else {
      originCode =
        ORIGIN_CODES[
          normalizedOrigin
        ] ?? null;
    }

    if (originCode === null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Origin must be a valid country name or UN Comtrade country code.",
        },
        { status: 400 }
      );
    }
  }

  if (
    !hsCode ||
    !/^\d{2,6}$/.test(hsCode)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A valid HS code is required (2 to 6 digits).",
      },
      { status: 400 }
    );
  }

  const currentYear =
    Number(year);

  if (
    !Number.isInteger(
      currentYear
    ) ||
    currentYear < 2010 ||
    currentYear > 2026
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Year must be between 2010 and 2026.",
      },
      { status: 400 }
    );
  }

  const previousYear =
    String(currentYear - 1);

  try {
    const [
      currentMarkets,
      previousMarkets,
    ] = await Promise.all([
      fetchYear(
        hsCode,
        String(currentYear)
      ),
      fetchYear(
        hsCode,
        previousYear
      ),
    ]);

    const screenedMarkets =
      screenMarkets(
        currentMarkets,
        previousMarkets,
        originCode
      );

    const originExportMap =
      new Map<
        number,
        BilateralExportResult
      >();

    let originDataAvailability:
      | "available"
      | "unavailable"
      | "unknown"
      | null = null;

    /*
     * Origin availability is checked once after market
     * screening. If the source has no dataset for the
     * selected reporter/year, avoid unnecessary bilateral
     * requests and never present the gap as zero exports.
     */
    if (originCode !== null) {
      originDataAvailability =
        await fetchOriginDataAvailability(
          originCode,
          String(currentYear)
        );

      for (const market of screenedMarkets) {
        if (
          originDataAvailability ===
          "unavailable"
        ) {
          originExportMap.set(
            market.countryCode,
            {
              status: "data_unavailable",
              value: null,
            }
          );
          continue;
        }

        const result =
          await fetchBilateralExport(
            hsCode,
            String(currentYear),
            originCode,
            market.countryCode
          );

        originExportMap.set(
          market.countryCode,
          result
        );
      }
    }

    const markets =
      screenedMarkets.map(
        (market) => {
          const originSignal =
            originCode !== null
              ? originExportMap.get(
                  market.countryCode
                ) ?? {
                  value: null,
                  status:
                    "unavailable" as const,
                }
              : null;

          const originExportValue =
            originSignal?.value ??
            null;

          const originShare =
            originExportValue !== null &&
            market.importValue > 0
              ? Number(
                  (
                    (originExportValue /
                      market.importValue) *
                    100
                  ).toFixed(2)
                )
              : null;

          const intelligence =
            buildMarketIntelligence({
              importValue:
                market.importValue,
              previousImportValue:
                market.previousImportValue,
              growthRate:
                market.growthRate,
              demandScore:
                market.demandScore,
              isReported:
                market.isReported,
              isEstimated:
                market.isEstimated,
              originExportValue,
              originExportStatus:
                originSignal?.status ??
                null,
              originShare,
            });

          const opportunity =
            buildOpportunitySignal({
              importValue:
                market.importValue,
              demandScore:
                market.demandScore,
              growthRate:
                market.growthRate,
              isReported:
                market.isReported,
              isEstimated:
                market.isEstimated,
              originExportValue,
              originExportStatus:
                originSignal?.status ??
                null,
              originShare,
            });

          return {
            ...market,
            unit: market.unit,
            trend: getTrend(
              market.growthRate
            ),
            originExportValue,
            originExportStatus:
              originSignal?.status ??
              null,
            originShare,
            intelligence,
            opportunity,
          };
        }
      );

    return NextResponse.json({
      ok: true,
      source: "UN Comtrade",
      year: String(currentYear),
      previousYear,
      hsCode,
      origin: originCode,

      markets,

      count: markets.length,

      screening: {
        methodology:
          "Global import demand and year-over-year growth are screened before origin-specific bilateral validation.",
        globalMarketsReturned:
          currentMarkets.length,
        screenedMarkets:
          screenedMarkets.length,
        originQueries:
          originCode !== null &&
          originDataAvailability !==
            "unavailable"
            ? screenedMarkets.length
            : 0,
        originDataAvailability,
        maxOriginCandidates: 8,
      },

      evidence: {
        source: "UN Comtrade",
        methodology:
          "Markets are screened using transparent demand, growth, and decline rules. Origin-specific evidence is then requested only for screened candidates.",
        preview: true,
      },
    });
  } catch (error) {
    console.error(
      "Trade analysis error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 502 }
    );
  }
}
