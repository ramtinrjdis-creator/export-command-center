import { NextResponse } from "next/server";
import {
  ComtradeRateLimitError,
  fetchComtradeJson,
} from "@/lib/comtrade-client";
import {
  buildSupplierLandscape,
  type SupplierInput,
} from "@/lib/providers/supplier-landscape";

const COMTRADE_BASE =
  "https://comtradeapi.un.org/public/v1/preview/C/A/HS";

type ComtradeSupplierRecord = {
  partnerCode?: number | string;
  partnerDesc?: string | null;
  partnerISO?: string | null;
  partnerIso?: string | null;
  primaryValue?: number | string | null;
};

type ComtradeResponse = { data?: unknown[] };

function buildComtradeUrl(input: {
  hsCode: string;
  year: number;
  reporterCode: number;
  partnerCode?: number;
}) {
  const url = new URL(COMTRADE_BASE);
  url.searchParams.set("cmdCode", input.hsCode);
  url.searchParams.set("flowCode", "M");
  url.searchParams.set("reporterCode", String(input.reporterCode));
  url.searchParams.set("partner2Code", "0");
  url.searchParams.set("period", String(input.year));
  url.searchParams.set("motCode", "0");
  url.searchParams.set("customsCode", "C00");
  url.searchParams.set("maxRecords", "500");
  url.searchParams.set("includeDesc", "true");

  if (input.partnerCode !== undefined) {
    url.searchParams.set("partnerCode", String(input.partnerCode));
  }

  return url.toString();
}

async function fetchSupplierRecords(
  hsCode: string,
  year: number,
  destinationCode: number,
): Promise<SupplierInput[]> {
  const payload = await fetchComtradeJson<ComtradeResponse>(
    buildComtradeUrl({
      hsCode,
      year,
      reporterCode: destinationCode,
    }),
  );

  const records = Array.isArray(payload.data)
    ? (payload.data as ComtradeSupplierRecord[])
    : [];

  return records
    .filter((record) => {
      const code = Number(record.partnerCode);
      const value = Number(record.primaryValue ?? 0);
      const partnerIso = String(
        record.partnerISO ?? record.partnerIso ?? "",
      ).toUpperCase();

      return (
        Number.isInteger(code) &&
        code > 0 &&
        code !== destinationCode &&
        partnerIso !== "W00" &&
        Number.isFinite(value) &&
        value > 0 &&
        typeof record.partnerDesc === "string" &&
        record.partnerDesc.trim().length > 0
      );
    })
    .map((record) => ({
      countryCode: Number(record.partnerCode),
      country: String(record.partnerDesc).trim(),
      importValue: Number(record.primaryValue ?? 0),
    }));
}

async function fetchWorldImportValue(
  hsCode: string,
  year: number,
  destinationCode: number,
): Promise<number | null> {
  const payload = await fetchComtradeJson<ComtradeResponse>(
    buildComtradeUrl({
      hsCode,
      year,
      reporterCode: destinationCode,
      partnerCode: 0,
    }),
  );

  const records = Array.isArray(payload.data)
    ? (payload.data as ComtradeSupplierRecord[])
    : [];

  const world = records.find(
    (record) => Number(record.partnerCode) === 0,
  );
  const value =
    world?.primaryValue == null ? null : Number(world.primaryValue);

  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hsCode = searchParams.get("hsCode")?.trim() || "";
  const marketParam = searchParams.get("market")?.trim() || "";
  const market = Number(marketParam);
  const marketName = searchParams.get("marketName")?.trim() || "";
  const originParam = searchParams.get("origin")?.trim() || "";
  const origin = originParam ? Number(originParam) : null;
  const yearParam = searchParams.get("year")?.trim() || "2025";
  const year = Number(yearParam);
  const limitParam = searchParams.get("limit")?.trim() || "12";
  const limit = Number(limitParam);

  if (!/^\d{2,6}$/.test(hsCode)) {
    return NextResponse.json(
      { ok: false, error: "A valid HS code is required (2 to 6 digits)." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(market) || market < 1) {
    return NextResponse.json(
      { ok: false, error: "Market must be a valid country code." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(year) || year < 2010 || year > 2026) {
    return NextResponse.json(
      { ok: false, error: "Year must be between 2010 and 2026." },
      { status: 400 },
    );
  }

  if (
    originParam &&
    (!Number.isInteger(origin) || (origin as number) < 1)
  ) {
    return NextResponse.json(
      { ok: false, error: "Origin must be a valid country code." },
      { status: 400 },
    );
  }

  const safeLimit =
    Number.isInteger(limit) && limit > 0 ? Math.min(limit, 25) : 12;
  const fetchedAt = new Date().toISOString();

  try {
    const [supplierInputs, totalImportValue] = await Promise.all([
      fetchSupplierRecords(hsCode, year, market),
      fetchWorldImportValue(hsCode, year, market),
    ]);

    const supplierLandscape = buildSupplierLandscape({
      destinationCode: market,
      hsCode,
      year,
      suppliers: supplierInputs,
      totalImportValue,
      originCode: origin,
    });

    return NextResponse.json({
      ok: true,
      market: { code: market, name: marketName || null },
      source: "UN Comtrade Preview API",
      fetchedAt,
      supplierLandscape: {
        ...supplierLandscape,
        suppliers: supplierLandscape.suppliers.slice(0, safeLimit),
      },
    });
  } catch (error) {
    if (error instanceof ComtradeRateLimitError) {
      const retryAfterSeconds =
        error.retryAfterMs == null
          ? null
          : Math.max(1, Math.ceil(error.retryAfterMs / 1000));

      return NextResponse.json(
        {
          ok: false,
          error:
            "The trade data source is temporarily rate-limited. Please retry shortly.",
          code: "upstream_rate_limited",
          retryable: true,
          ...(retryAfterSeconds !== null ? { retryAfterSeconds } : {}),
        },
        {
          status: 503,
          ...(retryAfterSeconds !== null
            ? {
                headers: {
                  "Retry-After": String(retryAfterSeconds),
                },
              }
            : {}),
        },
      );
    }

    console.error("Supplier landscape error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to retrieve supplier landscape data.",
        retryable: true,
      },
      { status: 502 },
    );
  }
}
