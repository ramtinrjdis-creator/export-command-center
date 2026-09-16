import { NextResponse } from "next/server";

const COMTRADE_BASE =
  "https://comtradeapi.un.org/public/v1/preview/C/A/HS";

const COUNTRY_NAMES: Record<number, string> = {
  36: "Australia",
  40: "Austria",
  56: "Belgium",
  76: "Brazil",
  124: "Canada",
  156: "China",
  191: "Croatia",
  208: "Denmark",
  250: "France",
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

type TradeMarket = {
  countryCode: number;
  country: string;
  importValue: number;
  quantity: number;
  unit: string | null;
  isReported: boolean;
  isEstimated: boolean;
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

  if (reporterCode !== undefined) {
    url.searchParams.set("reporterCode", String(reporterCode));
  }
  url.searchParams.set("motCode", "0");
  url.searchParams.set("customsCode", "C00");
  url.searchParams.set("maxRecords", "500");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Comtrade returned ${response.status}`);
  }

  const data = await response.json();
  const records = Array.isArray(data?.data) ? data.data : [];

  return records
    .filter(
      (item: any) =>
        item?.reporterCode &&
        Number(item?.primaryValue || 0) > 0
    )
    .map((item: any) => ({
      countryCode: Number(item.reporterCode),
      country:
        COUNTRY_NAMES[Number(item.reporterCode)] ||
        `Country ${item.reporterCode}`,
      importValue: Number(item.primaryValue || 0),
      quantity: Number(item.netWgt || item.qty || 0),
      unit: item.qtyUnitAbbr || item.netWgtUnitAbbr || null,
      isReported: Boolean(item.isReported),
      isEstimated:
        Boolean(item.isQtyEstimated) ||
        Number(item.legacyEstimationFlag || 0) !== 0,
    }));
}

async function fetchBilateralExport(
  hsCode: string,
  year: string,
  reporterCode: number,
  partnerCode: number
): Promise<number | null> {
  const url = new URL(COMTRADE_BASE);

  url.searchParams.set("cmdCode", hsCode);
  url.searchParams.set("flowCode", "X");
  url.searchParams.set("reporterCode", String(reporterCode));
  url.searchParams.set("partnerCode", String(partnerCode));
  url.searchParams.set("partner2Code", "0");
  url.searchParams.set("period", year);
  url.searchParams.set("motCode", "0");
  url.searchParams.set("customsCode", "C00");
  url.searchParams.set("maxRecords", "1");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Comtrade bilateral request returned ${response.status}`);
  }

  const data = await response.json();
  const record = Array.isArray(data?.data) ? data.data[0] : null;

  if (!record) return null;

  return Number(record.primaryValue || 0);
}

function getTrend(growthRate: number | null) {
  if (growthRate === null) return "Insufficient data";
  if (growthRate >= 10) return "Strong growth";
  if (growthRate >= 3) return "Growing";
  if (growthRate > -3) return "Stable";
  if (growthRate > -10) return "Declining";
  return "Strong decline";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const hsCode = searchParams.get("hsCode")?.trim();
  const year = searchParams.get("year")?.trim() || "2024";
  const originParam = searchParams.get("origin")?.trim();
  const origin = originParam ? Number(originParam) : null;
  const originCode: number | null =
    origin !== null && Number.isInteger(origin) ? origin : null;

  if (
    originParam &&
    (origin === null ||
      !Number.isInteger(origin) ||
      origin < 1)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Origin must be a valid UN Comtrade country code.",
      },
      { status: 400 }
    );
  }

  if (!hsCode || !/^\d{2,6}$/.test(hsCode)) {
    return NextResponse.json(
      {
        ok: false,
        error: "A valid HS code is required (2 to 6 digits).",
      },
      { status: 400 }
    );
  }

  const currentYear = Number(year);

  if (
    !Number.isInteger(currentYear) ||
    currentYear < 2010 ||
    currentYear > 2026
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Year must be between 2010 and 2026.",
      },
      { status: 400 }
    );
  }

  const previousYear = String(currentYear - 1);

  try {
    const [currentMarkets, previousMarkets] =
      await Promise.all([
        fetchYear(hsCode, String(currentYear)),
        fetchYear(hsCode, previousYear),
      ]);

    const originExportMap = new Map<
      number,
      { value: number | null; status: "recorded" | "no_record" | "unavailable" }
    >();

    if (originCode !== null) {
      const bilateralExports = await Promise.all(
        currentMarkets.map(async (market) => {
          try {
            const value = await fetchBilateralExport(
              hsCode,
              String(currentYear),
              originCode,
              market.countryCode
            );

            return [
              market.countryCode,
              {
                value,
                status: value === null ? "no_record" : "recorded",
              },
            ] as const;
          } catch {
            return [
              market.countryCode,
              {
                value: null,
                status: "unavailable",
              },
            ] as const;
          }
        })
      );

      for (const [countryCode, value] of bilateralExports) {
        originExportMap.set(countryCode, value);
      }
    }

    const previousMap = new Map(
      previousMarkets.map((market) => [
        market.countryCode,
        market.importValue,
      ])
    );

    const sortedMarkets = currentMarkets
      .map((market) => {
        const previousValue =
          previousMap.get(market.countryCode) ?? null;

        const growthRate =
          previousValue !== null && previousValue > 0
            ? ((market.importValue - previousValue) /
                previousValue) *
              100
            : null;

        const originSignal =
          origin !== null
            ? originExportMap.get(market.countryCode) ?? {
                value: null,
                status: "unavailable" as const,
              }
            : null;

        const originExportValue =
          originSignal?.value ?? null;

        const originShare =
          originExportValue !== null && market.importValue > 0
            ? (originExportValue / market.importValue) * 100
            : null;

        return {
          ...market,
          previousImportValue: previousValue,
          growthRate:
            growthRate === null
              ? null
              : Number(growthRate.toFixed(1)),
          trend: getTrend(growthRate),
          originExportValue,
          originExportStatus:
            originSignal?.status ?? null,
          originShare:
            originShare === null
              ? null
              : Number(originShare.toFixed(2)),
        };
      })
      .sort((a, b) => b.importValue - a.importValue)
      .slice(0, 20);

    const maxImport =
      sortedMarkets.length > 0
        ? sortedMarkets[0].importValue
        : 0;

    const totalReturnedImportValue = sortedMarkets.reduce(
      (sum, market) => sum + market.importValue,
      0
    );

    const markets = sortedMarkets.map((market) => {
      const marketShare =
        totalReturnedImportValue > 0
          ? (market.importValue / totalReturnedImportValue) * 100
          : 0;

      const growthSignal =
        market.growthRate === null
          ? null
          : Math.max(
              0,
              Math.min(100, 50 + market.growthRate * 2)
            );

      const dataQuality =
        market.isEstimated
          ? "Quantity/weight estimated"
          : "Reported quantity/weight";

      const marketQuality =
        growthSignal === null
          ? Math.round(marketShare * 2)
          : Math.round(
              marketShare * 0.5 +
              growthSignal * 0.3 +
              (market.isEstimated ? 15 : 20)
            );

      return {
        ...market,
        demandScore:
          maxImport > 0
            ? Math.round(
                (market.importValue / maxImport) * 100
              )
            : 0,
        marketShare: Number(marketShare.toFixed(2)),
        growthSignal:
          growthSignal === null
            ? null
            : Math.round(growthSignal),
        dataQuality,
        marketQuality: Math.min(100, marketQuality),
      };
    });

    return NextResponse.json({
      ok: true,
      source: "UN Comtrade",
      year: String(currentYear),
      previousYear,
      hsCode,
      origin,
      markets,
      count: markets.length,
      evidence: {
        source: "UN Comtrade",
        methodology:
          "Markets ranked by import value, with year-over-year growth calculated from the previous year.",
        preview: true,
      },
    });
  } catch (error) {
    console.error("Trade analysis error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to retrieve trade data.",
      },
      { status: 502 }
    );
  }
}
