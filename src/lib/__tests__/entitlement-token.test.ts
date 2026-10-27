import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyEntitlementToken } from "../commercial/entitlement-token";

function b64url(value: string | Uint8Array) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeToken(
  secret: string,
  nowMs: number,
  overrides: Record<string, unknown> = {},
) {
  const nowSeconds = Math.floor(nowMs / 1000);

  const payload = {
    v: 2,
    sub: "user-1",
    sid: "sub-1",
    customerId: "cus-1",
    provider: "test-billing",
    plan: "pro_monthly",
    status: "active",
    periodStart: "2026-10-01T00:00:00.000Z",
    periodEnd: "2026-11-01T00:00:00.000Z",
    entitlements: [
      "market_scan",
      "buyer_intelligence",
    ],
    iat: nowSeconds - 60,
    exp: nowSeconds + 600,
    aud: "export-command-center",
    iss: "export-command-center",
    jti: `jti-${nowSeconds}`,
    ...overrides,
  };

  const body = b64url(
    JSON.stringify(payload),
  );

  const signature = b64url(
    createHmac("sha256", secret)
      .update(body)
      .digest(),
  );

  return `${body}.${signature}`;
}

describe("entitlement token v2", () => {
  const secret =
    "01234567890123456789012345678901";

  const now =
    Date.parse("2026-10-08T12:00:00.000Z");

  it("accepts a signed active pro token", () => {
    const result = verifyEntitlementToken(
      makeToken(secret, now),
      secret,
      "buyer_intelligence",
      now,
    );

    expect(result.valid).toBe(true);
  });

  it("rejects a token signed with the wrong secret", () => {
    const result = verifyEntitlementToken(
      makeToken(secret, now),
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "buyer_intelligence",
      now,
    );

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.reason).toBe(
        "invalid_token_signature",
      );
    }
  });

  it("rejects pro access when the entitlement is absent", () => {
    const result = verifyEntitlementToken(
      makeToken(secret, now, {
        entitlements: ["market_scan"],
      }),
      secret,
      "buyer_intelligence",
      now,
    );

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.reason).toBe(
        "entitlement_not_granted",
      );
    }
  });

  it("rejects a one-year period encoded as a monthly plan", () => {
    const result = verifyEntitlementToken(
      makeToken(secret, now, {
        periodEnd:
          "2027-10-01T00:00:00.000Z",
      }),
      secret,
      "buyer_intelligence",
      now,
    );

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.reason).toBe(
        "billing_period_does_not_match_plan",
      );
    }
  });

  it("rejects an expired subscription period", () => {
    const result = verifyEntitlementToken(
      makeToken(secret, now, {
        periodStart:
          "2026-08-01T00:00:00.000Z",
        periodEnd:
          "2026-09-01T00:00:00.000Z",
      }),
      secret,
      "buyer_intelligence",
      now,
    );

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.reason).toBe(
        "period_expired",
      );
    }
  });

  it("rejects an expired token even when the subscription is active", () => {
    const result = verifyEntitlementToken(
      makeToken(secret, now, {
        exp:
          Math.floor(now / 1000) - 1,
      }),
      secret,
      "buyer_intelligence",
      now,
    );

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.reason).toBe(
        "token_expired",
      );
    }
  });

  it("rejects a token with an excessive lifetime", () => {
    const nowSeconds = Math.floor(
      now / 1000,
    );

    const result = verifyEntitlementToken(
      makeToken(secret, now, {
        iat: nowSeconds - 120,
        exp: nowSeconds + 1200,
      }),
      secret,
      "buyer_intelligence",
      now,
    );

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.reason).toBe(
        "token_lifetime_too_long",
      );
    }
  });

  it("rejects an invalid audience", () => {
    const result = verifyEntitlementToken(
      makeToken(secret, now, {
        aud: "wrong-audience",
      }),
      secret,
      "buyer_intelligence",
      now,
    );

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.reason).toBe(
        "invalid_audience",
      );
    }
  });

  it("rejects an invalid issuer", () => {
    const result = verifyEntitlementToken(
      makeToken(secret, now, {
        iss: "wrong-issuer",
      }),
      secret,
      "buyer_intelligence",
      now,
    );

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.reason).toBe(
        "invalid_issuer",
      );
    }
  });
});
