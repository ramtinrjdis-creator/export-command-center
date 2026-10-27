import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decideCommercialAccess,
} from "../commercial/access-decision";
import {
  assertTokenReplaySafe,
} from "../commercial/entitlement-token";
import {
  clearUsageLedger,
  checkUsage,
  commitUsage,
  releaseUsage,
  reserveUsage,
} from "../commercial/usage-ledger";

function tokenBody(
  overrides: Record<string, unknown> = {},
) {
  return {
    v: 2,
    sub: "user-1",
    sid: "sub-1",
    customerId: "cus-1",
    provider: "billing-test",
    plan: "pro_monthly",
    status: "active",
    periodStart: "2026-10-01T00:00:00.000Z",
    periodEnd: "2026-11-01T00:00:00.000Z",
    entitlements: [
      "buyer_intelligence",
      "decision_pack",
      "deep_analysis",
    ],
    iat: 1791417600,
    exp: 1791418500,
    aud: "export-command-center",
    iss: "export-command-center",
    jti: "jti-v14",
    ...overrides,
  };
}

function makeToken(
  secret: string,
  overrides: Record<string, unknown> = {},
) {
  const body = Buffer.from(
    JSON.stringify(
      tokenBody(overrides),
    ),
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const signature = Buffer.from(
    createHmac("sha256", secret)
      .update(body)
      .digest(),
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${body}.${signature}`;
}

describe("commercial V14", () => {
  const secret =
    "01234567890123456789012345678901";

  it("keeps free capabilities available without paid entitlement", () => {
    const result = decideCommercialAccess({
      capability: "market_scan",
      token: null,
      secret,
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.plan).toBe("free");
    }
  });

  it("fails closed for paid capabilities without a token", () => {
    const result = decideCommercialAccess({
      capability: "buyer_intelligence",
      token: null,
      secret,
    });

    expect(result.allowed).toBe(false);
  });

  it("rejects a paid token with an excessive lifetime", () => {
    const token = makeToken(
      secret,
      {
        exp: 1791419500,
      },
    );

    const result = decideCommercialAccess({
      capability: "buyer_intelligence",
      token,
      secret,
      nowMs: 1791417600 * 1000,
    });

    expect(result.allowed).toBe(false);
  });

  it("does not allow the same jti to be replayed in the same ledger window", () => {
    const seen = new Set<string>();

    expect(
      assertTokenReplaySafe(
        seen,
        "jti-v14",
      ),
    ).toBe(true);

    seen.add("jti-v14");

    expect(
      assertTokenReplaySafe(
        seen,
        "jti-v14",
      ),
    ).toBe(false);
  });

  it("reserves and commits usage atomically within the local ledger", () => {
    clearUsageLedger();

    const reservation = reserveUsage({
      plan: "pro_monthly",
      userId: "user-1",
      metric: "buyer_provider_queries",
    });

    expect(reservation.allowed).toBe(true);

    if (reservation.allowed) {
      const committed = commitUsage(
        reservation.id,
      );

      expect(committed.committed).toBe(true);

      const state = checkUsage(
        "pro_monthly",
        "user-1",
        "buyer_provider_queries",
      );

      expect(state.allowed).toBe(true);
    }
  });

  it("does not double-count a released reservation", () => {
    clearUsageLedger();

    const reservation = reserveUsage({
      plan: "pro_monthly",
      userId: "user-2",
      metric: "deep_analyses",
    });

    expect(reservation.allowed).toBe(true);

    if (reservation.allowed) {
      expect(
        releaseUsage(reservation.id).released,
      ).toBe(true);

      expect(
        releaseUsage(reservation.id).released,
      ).toBe(false);

      const state = checkUsage(
        "pro_monthly",
        "user-2",
        "deep_analyses",
      );

      if (state.allowed) {
        expect(state.remaining).toBe(
          state.limit,
        );
      }
    }
  });
});
