type ComtradeClientOptions = {
  timeoutMs?: number;
  minIntervalMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  cacheTtlMs?: number;
};

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MIN_INTERVAL_MS = 400;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_BASE_MS = 700;
const DEFAULT_CACHE_TTL_MS = (() => {
  const configured = Number(process.env.ECC_COMTRADE_CACHE_TTL_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.round(configured)
    : 15 * 60 * 1000;
})();
const MAX_CACHE_ENTRIES = 250;

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const responseCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<unknown>>();

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;

export class ComtradeRateLimitError extends Error {
  readonly retryAfterMs: number | null;

  constructor(retryAfterMs: number | null) {
    super("Comtrade rate limit reached.");
    this.name = "ComtradeRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfterMs(
  value: string | null,
): number | null {
  if (!value) return null;

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.round(seconds * 1000));
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) return null;

  return Math.max(0, timestamp - Date.now());
}

async function runSerialized<T>(
  task: () => Promise<T>,
  minIntervalMs: number,
): Promise<T> {
  const previous = requestQueue;

  let release!: () => void;

  requestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    const elapsed =
      Date.now() - lastRequestStartedAt;

    const remaining = Math.max(
      0,
      minIntervalMs - elapsed,
    );

    if (remaining > 0) {
      await sleep(remaining);
    }

    lastRequestStartedAt = Date.now();

    return await task();
  } finally {
    release();
  }
}

function pruneCache() {
  const now = Date.now();

  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) {
      responseCache.delete(key);
    }
  }

  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey =
      responseCache.keys().next().value;

    if (oldestKey === undefined) break;

    responseCache.delete(oldestKey);
  }
}

function setCache(
  url: string,
  value: unknown,
  ttlMs: number,
) {
  if (ttlMs <= 0) return;

  pruneCache();

  responseCache.set(url, {
    expiresAt: Date.now() + ttlMs,
    value,
  });

  pruneCache();
}

export async function fetchComtradeJson<T>(
  url: string,
  options: ComtradeClientOptions = {},
): Promise<T> {
  const timeoutMs =
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const minIntervalMs =
    options.minIntervalMs ??
    DEFAULT_MIN_INTERVAL_MS;

  const maxRetries =
    options.maxRetries ??
    DEFAULT_MAX_RETRIES;

  const backoffBaseMs =
    options.backoffBaseMs ??
    DEFAULT_BACKOFF_BASE_MS;

  const cacheTtlMs =
    options.cacheTtlMs ??
    DEFAULT_CACHE_TTL_MS;

  pruneCache();

  const cached = responseCache.get(url);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.value as T;
  }

  if (cached) {
    responseCache.delete(url);
  }

  const inflight =
    inflightRequests.get(url);

  if (inflight) {
    return (await inflight) as T;
  }

  const requestPromise =
    (async (): Promise<T> => {
      for (
        let attempt = 0;
        attempt <= maxRetries;
        attempt += 1
      ) {
        let response: Response;

        try {
          response =
            await runSerialized(
              () =>
                fetch(url, {
                  headers: {
                    Accept:
                      "application/json",
                  },
                  cache: "no-store",
                  signal:
                    AbortSignal.timeout(
                      timeoutMs,
                    ),
                }),
              minIntervalMs,
            );
        } catch (error) {
          if (
            attempt >= maxRetries
          ) {
            throw error;
          }

          await sleep(
            backoffBaseMs *
              2 ** attempt,
          );

          continue;
        }

        if (response.ok) {
          const value =
            (await response.json()) as T;

          setCache(
            url,
            value,
            cacheTtlMs,
          );

          return value;
        }

        if (response.status === 429) {
          const retryAfterMs =
            parseRetryAfterMs(
              response.headers.get(
                "retry-after",
              ),
            );

          if (
            attempt < maxRetries
          ) {
            await sleep(
              retryAfterMs ??
                backoffBaseMs *
                  2 ** attempt,
            );

            continue;
          }

          throw new ComtradeRateLimitError(
            retryAfterMs,
          );
        }

        if (
          (
            response.status === 408 ||
            (
              response.status >= 500 &&
              response.status <= 599
            )
          ) &&
          attempt < maxRetries
        ) {
          await sleep(
            backoffBaseMs *
              2 ** attempt,
          );

          continue;
        }

        throw new Error(
          `Comtrade returned ${response.status}`,
        );
      }

      throw new Error(
        "Comtrade request failed.",
      );
    })();

  inflightRequests.set(
    url,
    requestPromise,
  );

  try {
    return await requestPromise;
  } finally {
    inflightRequests.delete(url);
  }
}

export function clearComtradeCache() {
  responseCache.clear();
}

export function getComtradeCacheStats() {
  pruneCache();

  return {
    entries: responseCache.size,
    inflight: inflightRequests.size,
  };
}
