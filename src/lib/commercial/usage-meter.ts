type UsageBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, UsageBucket>();

export function consumeUsage(
  key: string,
  limit: number,
  windowMs = 24 * 60 * 60 * 1000
) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const next: UsageBucket = {
      count: 1,
      resetAt: now + windowMs,
    };

    buckets.set(key, next);

    return {
      allowed: true,
      count: next.count,
      remaining: Math.max(0, limit - next.count),
      resetAt: next.resetAt,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      count: current.count,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;

  return {
    allowed: true,
    count: current.count,
    remaining: Math.max(
      0,
      limit - current.count
    ),
    resetAt: current.resetAt,
  };
}

export function getUsage(key: string) {
  return buckets.get(key) ?? null;
}

export function resetUsage(key?: string) {
  if (key) {
    buckets.delete(key);
    return;
  }

  buckets.clear();
}
