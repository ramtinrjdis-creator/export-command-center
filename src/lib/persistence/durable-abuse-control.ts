import "server-only";

import { query } from "./postgres";

const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;

export type AbuseBudgetInput = {
  accountId: string;
  userId: string;
  capability: string;
  limit: number;
  windowMs: number;
};

export type AbuseBudgetResult = {
  allowed: boolean;
  used: number | null;
  windowStartedAt: number;
};

/**
 * Durable fixed-window limiter.
 *
 * Callers must derive accountId and userId from trusted server
 * authentication, never from an arbitrary client-supplied identity.
 *
 * Policy limits must come from trusted server configuration.
 * This module is not yet connected to a production request route.
 */
export async function consumeAbuseBudget(
  input: AbuseBudgetInput,
): Promise<AbuseBudgetResult> {
  if (
    ![
      input.accountId,
      input.userId,
      input.capability,
    ].every(value => SAFE_ID.test(value)) ||
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 1000000 ||
    !Number.isSafeInteger(input.windowMs) ||
    input.windowMs < 1000 ||
    input.windowMs > 86400000
  ) {
    throw new Error("invalid_abuse_budget_policy");
  }

  const now = Date.now();
  const windowStartedAt =
    Math.floor(now / input.windowMs) * input.windowMs;

  if (!Number.isSafeInteger(windowStartedAt)) {
    throw new Error("invalid_abuse_budget_time");
  }

  // The tuple structure avoids ambiguous string concatenation.
  // Never use IP headers or client-provided account IDs as authority.
  const scopeKey = JSON.stringify([
    "ecc-abuse-v16",
    input.accountId,
    input.userId,
    input.capability,
    input.windowMs,
  ]);

  /*
   * PostgreSQL serializes conflicting INSERT/UPSERT operations
   * on the scope_key primary key.
   *
   * No separate read-then-write race.
   * A denied request does not increment the counter.
   */
  const result = await query<{ used: string }>(
    `
    INSERT INTO ecc_abuse_counters (
      scope_key,
      window_started_at,
      count,
      updated_at
    )
    VALUES ($1, $2, 1, NOW())
    ON CONFLICT (scope_key)
    DO UPDATE SET
      window_started_at = EXCLUDED.window_started_at,
      count = CASE
        WHEN ecc_abuse_counters.window_started_at <
             EXCLUDED.window_started_at
        THEN 1
        ELSE ecc_abuse_counters.count + 1
      END,
      updated_at = NOW()
    WHERE
      ecc_abuse_counters.window_started_at <=
        EXCLUDED.window_started_at
      AND (
        ecc_abuse_counters.window_started_at <
          EXCLUDED.window_started_at
        OR ecc_abuse_counters.count < $3
      )
    RETURNING count::text AS used
    `,
    [scopeKey, windowStartedAt, input.limit],
  );

  if (result.rows.length === 0) {
    return {
      allowed: false,
      used: null,
      windowStartedAt,
    };
  }

  const used = Number(result.rows[0].used);

  if (
    !Number.isSafeInteger(used) ||
    used < 1 ||
    used > input.limit
  ) {
    throw new Error("invalid_abuse_budget_counter");
  }

  return {
    allowed: true,
    used,
    windowStartedAt,
  };
}
