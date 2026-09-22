import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ComtradeRateLimitError,
  fetchComtradeJson,
} from "@/lib/comtrade-client";
import {
  buildSupplierLandscape,
  type SupplierInput,
} from "@/lib/providers/supplier-landscape";

export const dynamic = "force-dynamic";

const COMTRADE_BASE =
  "https://comtradeapi.un.org/public/v1/preview/C/A/HS";

const CACHE_TTL_MS = 60 * 1000;

type ComtradeSupplierRecord = {
  partnerCode?: number | string;
  partnerDesc?: string | null;
  partnerISO?: string | null;
  partnerIso?: string | null;
  primaryValue?: number | string | null;
};

type ComtradeResponse = {
  data?: unknown[];
};

type SupplierQuery = {
  hsCode: string;
  market: number;
  marketName: string;
  origin: number | null;
  year: number;
  limit: number;
};

type SupplierPayload = {
  supplierLandscape: ReturnType<
    typeof buildSupplierLandscape
  >;
  fetchedAt: string;
};

type CacheEntry = {
  expiresAt: number;
  payload: SupplierPayload;
};

const responseCache = new Map<
  string,
  CacheEntry
>();

const inFlight = new Map<
  string,
  Promise<SupplierPayload>
>();

function buildComtradeUrl(input: {
  hsCode: string;
  year: number;
  reporterCode: number;
  partnerCode?: number;
}) {
  const url = new URL(COMTRADE_BASE);

  url.searchParams.set(
    "cmdCode",
    input.hsCode,
  );

  url.searchParams.set(
    "flowCode",
    "M",
  );

  url.searchParams.set(
    "reporterCode",
    String(input.reporterCode),
  );

  url.searchParams.set(
    "partner2Code",
    "0",
  );

  url.searchParams.set(
    "period",
    String(input.year),
  );

  url.searchParams.set(
    "motCode",
    "0",
  );

  url.searchParams.set(
    "customsCode",
    "C00",
  );

  url.searchParams.set(
    "maxRecords",
    "500",
  );

  url.searchParams.set(
    "includeDesc",
    "true",
  );

  if (
    input.partnerCode !== undefined
  ) {
    url.searchParams.set(
      "partnerCode",
      String(input.partnerCode),
    );
  }

  return url.toString();
}

export function parseSupplierQuery(
  searchParams: URLSearchParams,
): {
  ok: true;
  value: SupplierQuery;
} | {
  ok: false;
  error: string;
} {
  const hsCode =
    searchParams.get("hsCode")?.trim() ||
    "";

  const marketParam =
    searchParams.get("market")?.trim() ||
    "";

  const originParam =
    searchParams.get("origin")?.trim() ||
    "";

  const market =
    Number(marketParam);

  const origin =
    originParam
      ? Number(originParam)
      : null;

  const year =
    Number(
      searchParams.get("year")?.trim() ||
      "2025",
    );

  const limit =
    Number(
      searchParams.get("limit")?.trim() ||
      "12",
    );

  const marketName =
    searchParams.get("marketName")?.trim() ||
    "";

  if (
    !/^\d{2,6}$/.test(hsCode)
  ) {
    return {
      ok: false,
      error:
        "A valid HS code is required (2 to 6 digits).",
    };
  }

  if (
    !Number.isInteger(market) ||
    market < 1
  ) {
    return {
      ok: false,
      error:
        "Market must be a valid country code.",
    };
  }

  if (
    !Number.isInteger(year) ||
    year < 2010 ||
    year > 2026
  ) {
    return {
      ok: false,
      error:
        "Year must be between 2010 and 2026.",
    };
  }

  if (
    originParam &&
    (
      !Number.isInteger(origin) ||
      (origin as number) < 1
    )
  ) {
    return {
      ok: false,
      error:
        "Origin must be a valid country code.",
    };
  }

  const safeLimit =
    Number.isInteger(limit) &&
    limit > 0
      ? Math.min(limit, 25)
      : 12;

  return {
    ok: true,
    value: {
      hsCode,
      market,
      marketName,
      origin,
      year,
      limit: safeLimit,
    },
  };
}

function buildCacheKey(
  query: SupplierQuery,
) {
  return [
    query.hsCode,
    query.market,
    query.origin ?? "none",
    query.year,
    query.limit,
  ].join(":");
}

async function fetchSupplierRecords(
  hsCode: string,
  year: number,
  destinationCode: number,
): Promise<SupplierInput[]> {
  const payload =
    await fetchComtradeJson<ComtradeResponse>(
      buildComtradeUrl({
        hsCode,
        year,
        reporterCode:
          destinationCode,
      }),
    );

  const records =
    Array.isArray(payload.data)
      ? (
          payload.data as
            ComtradeSupplierRecord[]
        )
      : [];

  return records
    .filter((record) => {
      const code =
        Number(record.partnerCode);

      const value =
        Number(
          record.primaryValue ?? 0,
        );

      const partnerIso =
        String(
          record.partnerISO ??
          record.partnerIso ??
          "",
        ).toUpperCase();

      const name =
        String(
          record.partnerDesc ?? "",
        ).trim();

      return (
        Number.isInteger(code) &&
        code > 0 &&
        code !== destinationCode &&
        partnerIso !== "W00" &&
        Number.isFinite(value) &&
        value > 0 &&
        name.length > 0
      );
    })
    .map((record) => ({
      countryCode:
        Number(record.partnerCode),
      country:
        String(
          record.partnerDesc,
        ).trim(),
      importValue:
        Number(
          record.primaryValue ?? 0,
        ),
    }));
}

async function fetchWorldImportValue(
  hsCode: string,
  year: number,
  destinationCode: number,
): Promise<number | null> {
  const payload =
    await fetchComtradeJson<ComtradeResponse>(
      buildComtradeUrl({
        hsCode,
        year,
        reporterCode:
          destinationCode,
        partnerCode: 0,
      }),
    );

  const records =
    Array.isArray(payload.data)
      ? (
          payload.data as
            ComtradeSupplierRecord[]
        )
      : [];

  const world =
    records.find(
      (record) =>
        Number(record.partnerCode) === 0,
    );

  const value =
    world?.primaryValue == null
      ? null
      : Number(
          world.primaryValue,
        );

  if (
    value == null ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  return value;
}

async function loadSupplierPayload(
  query: SupplierQuery,
): Promise<SupplierPayload> {
  const cacheKey =
    buildCacheKey(query);

  const cached =
    responseCache.get(cacheKey);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.payload;
  }

  if (cached) {
    responseCache.delete(
      cacheKey,
    );
  }

  const running =
    inFlight.get(cacheKey);

  if (running) {
    return running;
  }

  const promise =
    (async () => {
      const [
        supplierInputs,
        totalImportValue,
      ] =
        await Promise.all([
          fetchSupplierRecords(
            query.hsCode,
            query.year,
            query.market,
          ),
          fetchWorldImportValue(
            query.hsCode,
            query.year,
            query.market,
          ),
        ]);

      const supplierLandscape =
        buildSupplierLandscape({
          destinationCode:
            query.market,
          hsCode:
            query.hsCode,
          year:
            query.year,
          suppliers:
            supplierInputs,
          totalImportValue,
          originCode:
            query.origin,
        });

      return {
        supplierLandscape,
        fetchedAt:
          new Date().toISOString(),
      };
    })();

  inFlight.set(
    cacheKey,
    promise,
  );

  try {
    const payload =
      await promise;

    responseCache.set(
      cacheKey,
      {
        expiresAt:
          Date.now() +
          CACHE_TTL_MS,
        payload,
      },
    );

    return payload;
  } finally {
    inFlight.delete(
      cacheKey,
    );
  }
}

export async function GET(
  request: Request,
) {
  const requestId =
    randomUUID();

  const startedAt =
    performance.now();

  const { searchParams } =
    new URL(request.url);

  const parsed =
    parseSupplierQuery(
      searchParams,
    );

  if (!parsed.ok) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        durationMs: Math.round(
          performance.now() -
            startedAt,
        ),
        error: parsed.error,
      },
      { status: 400 },
    );
  }

  const query =
    parsed.value;

  const cacheKey =
    buildCacheKey(query);

  const cached =
    responseCache.get(
      cacheKey,
    );

  const cacheHit =
    Boolean(
      cached &&
      cached.expiresAt >
        Date.now(),
    );

  try {
    const payload =
      await loadSupplierPayload(
        query,
      );

    const suppliers =
      payload
        .supplierLandscape
        .suppliers
        .slice(0, query.limit);

    return NextResponse.json(
      {
        ok: true,
        requestId,
        durationMs: Math.max(
          0,
          Math.round(
            performance.now() -
              startedAt,
          ),
        ),
        market: {
          code: query.market,
          name:
            query.marketName ||
            null,
        },
        source:
          "UN Comtrade Preview API",
        fetchedAt:
          payload.fetchedAt,
        cache: cacheHit
          ? "hit"
          : "miss",
        suppliers,
        supplierLandscape: {
          ...payload.supplierLandscape,
          suppliers,
        },
      },
    );
  } catch (error) {
    if (
      error instanceof
      ComtradeRateLimitError
    ) {
      const retryAfterSeconds =
        error.retryAfterMs == null
          ? null
          : Math.max(
              1,
              Math.ceil(
                error.retryAfterMs /
                  1000,
              ),
            );

      return NextResponse.json(
        {
          ok: false,
          requestId,
          durationMs: Math.max(
            0,
            Math.round(
              performance.now() -
                startedAt,
            ),
          ),
          error:
            "The trade data source is temporarily rate-limited. Please retry shortly.",
          code:
            "upstream_rate_limited",
          retryable: true,
          ...(retryAfterSeconds !==
          null
            ? {
                retryAfterSeconds,
              }
            : {}),
        },
        {
          status: 503,
          ...(retryAfterSeconds !==
          null
            ? {
                headers: {
                  "Retry-After":
                    String(
                      retryAfterSeconds,
                    ),
                },
              }
            : {}),
        },
      );
    }

    console.error(
      "Supplier landscape error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        requestId,
        durationMs: Math.max(
          0,
          Math.round(
            performance.now() -
              startedAt,
          ),
        ),
        error:
          "Unable to retrieve supplier landscape data.",
        code:
          "supplier_landscape_unavailable",
        retryable: true,
      },
      { status: 502 },
    );
  }
}
