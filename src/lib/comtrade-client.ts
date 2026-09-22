type ComtradeClientOptions = {
  timeoutMs?: number;
  minIntervalMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
};

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MIN_INTERVAL_MS = 400;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_BASE_MS = 700;

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

function parseRetryAfterMs(value: string | null): number | null {
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
    const elapsed = Date.now() - lastRequestStartedAt;
    const remaining = Math.max(0, minIntervalMs - elapsed);

    if (remaining > 0) {
      await sleep(remaining);
    }

    lastRequestStartedAt = Date.now();

    return await task();
  } finally {
    release();
  }
}

export async function fetchComtradeJson<T>(
  url: string,
  options: ComtradeClientOptions = {},
): Promise<T> {
  const timeoutMs =
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const minIntervalMs =
    options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const maxRetries =
    options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const backoffBaseMs =
    options.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;

    try {
      response = await runSerialized(
        () =>
          fetch(url, {
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(timeoutMs),
          }),
        minIntervalMs,
      );
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }

      await sleep(backoffBaseMs * 2 ** attempt);
      continue;
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(
        response.headers.get("retry-after"),
      );

      if (attempt < maxRetries) {
        await sleep(
          retryAfterMs ??
            backoffBaseMs * 2 ** attempt,
        );
        continue;
      }

      throw new ComtradeRateLimitError(retryAfterMs);
    }

    if (
      (response.status === 408 ||
        (response.status >= 500 &&
          response.status <= 599)) &&
      attempt < maxRetries
    ) {
      await sleep(backoffBaseMs * 2 ** attempt);
      continue;
    }

    throw new Error(
      `Comtrade returned ${response.status}`,
    );
  }

  throw new Error("Comtrade request failed.");
}
