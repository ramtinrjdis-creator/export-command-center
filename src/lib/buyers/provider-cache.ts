type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 250;

function getTtlMs() {
  const value = Number(process.env.BUYER_PROVIDER_CACHE_TTL_MS ?? DEFAULT_TTL_MS);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_TTL_MS;
  return Math.min(value, 60 * 60 * 1000);
}

function prune(now = Date.now()) {
  for (const [key, entry] of cache.entries()) if (entry.expiresAt <= now) cache.delete(key);
  while (cache.size > MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

export function buildBuyerProviderCacheKey(input: {
  provider: string;
  hsCode: string;
  marketCode: number;
  productDescription?: string;
  limit: number;
}) {
  return JSON.stringify({
    provider: input.provider,
    hsCode: input.hsCode.trim(),
    marketCode: input.marketCode,
    productDescription: input.productDescription?.trim().toLowerCase() ?? "",
    limit: input.limit,
  });
}

export async function getCachedBuyerProviderResult<T>(key: string, loader: () => Promise<T>) {
  const now = Date.now();
  prune(now);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return { value: cached.value as T, hit: true };
  const active = inFlight.get(key) as Promise<T> | undefined;
  if (active) return { value: await active, hit: true };

  const promise = loader();
  inFlight.set(key, promise as Promise<unknown>);
  try {
    const value = await promise;
    const ttl = getTtlMs();
    if (ttl > 0) cache.set(key, { value, expiresAt: Date.now() + ttl });
    return { value, hit: false };
  } finally {
    inFlight.delete(key);
    prune();
  }
}

export function clearBuyerProviderCache() {
  cache.clear();
  inFlight.clear();
}
