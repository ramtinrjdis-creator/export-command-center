import { NextResponse } from "next/server";
import {
  ComtradeRateLimitError,
  fetchComtradeJson,
} from "@/lib/comtrade-client";
import {
  buildSupplierLandscape,
  type SupplierInput,
  type SupplierLandscape,
} from "@/lib/providers/supplier-landscape";

const COMTRADE_BASE =
  "https://comtradeapi.un.org/public/v1/preview/C/A/HS";

const SUPPLIER_CACHE_TTL_MS = 60_000;
const SUPPLIER_CACHE_MAX_ENTRIES = 100;

type SupplierCacheEntry = {
  expiresAt: number;
  landscape: SupplierLandscape;
  fetchedAt: string;
};

const supplierCache = new Map<string, SupplierCacheEntry>();
const supplierInflight = new Map<
  string,
  Promise<{ landscape: SupplierLandscape; fetchedAt: string }>
>();

function supplierCacheKey(input: {
  hsCode: string;
  market: number;
  origin: number | null;
  year: number;
}) {
  return [
    input.hsCode,
    input.market,
    input.origin ?? "none",
    input.year,
  ].join(":");
}

function readSupplierCache(key: string) {
  const entry = supplierCache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    supplierCache.delete(key);
    return null;
  }

  return entry;
}

function writeSupplierCache(
  key: string,
  landscape: SupplierLandscape,
  fetchedAt: string,
) {
  const now = Date.now();

  for (const [entryKey, entry] of supplierCache.entries()) {
    if (entry.expiresAt <= now) {
      supplierCache.delete(entryKey);
    }
  }

  while (supplierCache.size >= SUPPLIER_CACHE_MAX_ENTRIES) {
    const oldestKey = supplierCache.keys().next().value;

    if (typeof oldestKey !== "string") {
      break;
    }

    supplierCache.delete(oldestKey);
  }

  supplierCache.set(key, {
    expiresAt: now + SUPPLIER_CACHE_TTL_MS,
    landscape,
    fetchedAt,
  });
}

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

  const requestId = crypto.randomUUID();
  const startedAt = performance.now();

  const cacheKey = supplierCacheKey({
    hsCode,
    market,
    origin,
    year,
  });

  const cached = readSupplierCache(cacheKey);

  if (cached) {
    return NextResponse.json(
      {
        ok: true,
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
        cache: "hit",
        market: { code: market, name: marketName || null },
        source: "UN Comtrade Preview API",
        fetchedAt: cached.fetchedAt,
        cacheTtlSeconds: SUPPLIER_CACHE_TTL_MS / 1000,
        supplierLandscape: {
          ...cached.landscape,
          suppliers: cached.landscape.suppliers.slice(0, safeLimit),
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      },
    );
  }

  const existingRequest = supplierInflight.get(cacheKey);

  if (existingRequest) {
    const shared = await existingRequest;

    return NextResponse.json(
      {
        ok: true,
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
        cache: "inflight-shared",
        market: { code: market, name: marketName || null },
        source: "UN Comtrade Preview API",
        fetchedAt: shared.fetchedAt,
        cacheTtlSeconds: SUPPLIER_CACHE_TTL_MS / 1000,
        supplierLandscape: {
          ...shared.landscape,
          suppliers: shared.landscape.suppliers.slice(0, safeLimit),
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      },
    );
  }

  const requestPromise = (async () => {
    const fetchedAt = new Date().toISOString();

    const [supplierInputs, totalImportValue] = await Promise.all([
      fetchSupplierRecords(hsCode, year, market),
      fetchWorldImportValue(hsCode, year, market),
    ]);

    const landscape = buildSupplierLandscape({
      destinationCode: market,
      hsCode,
      year,
      suppliers: supplierInputs,
      totalImportValue,
      originCode: origin,
    });

    return {
      landscape,
      fetchedAt,
    };
  })();

  supplierInflight.set(cacheKey, requestPromise);

  try {
    const shared = await requestPromise;

    writeSupplierCache(
      cacheKey,
      shared.landscape,
      shared.fetchedAt,
    );

    return NextResponse.json(
      {
        ok: true,
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
        cache: "miss",
        market: { code: market, name: marketName || null },
        source: "UN Comtrade Preview API",
        fetchedAt: shared.fetchedAt,
        cacheTtlSeconds: SUPPLIER_CACHE_TTL_MS / 1000,
        supplierLandscape: {
          ...shared.landscape,
          suppliers: shared.landscape.suppliers.slice(0, safeLimit),
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      },
    );
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
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
        error: "Unable to retrieve supplier landscape data.",
        retryable: true,
      },
      { status: 502 },
    );
  } finally {
    supplierInflight.delete(cacheKey);
  }
}
