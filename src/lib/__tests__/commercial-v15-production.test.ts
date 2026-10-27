import { describe, expect, it } from "vitest";

import {
  evaluateServerEntitlement,
  InMemoryAbuseController,
} from "../commercial/v15-access";

import {
  InMemoryBillingIdempotencyStore,
  beginBillingEvent,
  hashBillingPayload,
  markBillingEventProcessed,
} from "../commercial/v15-billing-events";

import {
  validateTrustedIdentity,
  normalizeRequestIdentityMetadata,
} from "../commercial/v15-identity";

import {
  evaluateV15Readiness,
} from "../commercial/v15-readiness";

import {
  InMemorySubscriptionStore,
} from "../commercial/v15-subscription-store";

import {
  InMemoryUsageStore,
} from "../commercial/v15-usage-store";

const identity = {
  userId: "user_1",
  accountId: "account_1",
  authenticated: true as const,
  issuedAt: 1_700_000_000,
  source: "test-auth",
};

const subscription = {
  subscriptionId: "sub_1",
  customerId: "cus_1",
  accountId: "account_1",
  state: "active" as const,
  planId: "pro_monthly",
  entitlementIds: ["buyer_intelligence"],
  currentPeriodStart: 1_700_000_000,
  currentPeriodEnd: 1_700_100_000,
  cancelAtPeriodEnd: false,
  updatedAt: 1_700_000_000,
  source: "test-billing",
};

describe("commercial V15 production core", () => {
  it("accepts a valid trusted identity", () => {
    expect(
      validateTrustedIdentity(identity),
    ).toEqual(identity);
  });

  it("rejects unauthenticated identity", () => {
    expect(
      validateTrustedIdentity({
        ...identity,
        authenticated: false as never,
      }),
    ).toBeNull();
  });

  it("fails closed when subscription is missing", () => {
    const result =
      evaluateServerEntitlement({
        identity,
        subscription: null,
        requiredEntitlement:
          "buyer_intelligence",
        now: 1_700_000_100,
      });

    expect(result.allowed).toBe(false);

    if (!result.allowed) {
      expect(result.code).toBe(
        "subscription_required",
      );
    }
  });

  it("fails closed on account mismatch", () => {
    const result =
      evaluateServerEntitlement({
        identity,
        subscription: {
          ...subscription,
          accountId: "other_account",
        },
        requiredEntitlement:
          "buyer_intelligence",
        now: 1_700_000_100,
      });

    expect(result.allowed).toBe(false);

    if (!result.allowed) {
      expect(result.code).toBe(
        "account_mismatch",
      );
    }
  });

  it("fails closed after subscription expiry", () => {
    const result =
      evaluateServerEntitlement({
        identity,
        subscription,
        requiredEntitlement:
          "buyer_intelligence",
        now: 1_700_100_000,
      });

    expect(result.allowed).toBe(false);

    if (!result.allowed) {
      expect(result.code).toBe(
        "subscription_expired",
      );
    }
  });

  it("requires the requested entitlement", () => {
    const result =
      evaluateServerEntitlement({
        identity,
        subscription,
        requiredEntitlement:
          "decision_pack",
        now: 1_700_000_100,
      });

    expect(result.allowed).toBe(false);

    if (!result.allowed) {
      expect(result.code).toBe(
        "entitlement_missing",
      );
    }
  });

  it("allows active server-side entitlement", () => {
    const result =
      evaluateServerEntitlement({
        identity,
        subscription,
        requiredEntitlement:
          "buyer_intelligence",
        now: 1_700_000_100,
      });

    expect(result.allowed).toBe(true);

    if (result.allowed) {
      expect(result.accountId).toBe(
        "account_1",
      );

      expect(result.expiresAt).toBe(
        subscription.currentPeriodEnd,
      );
    }
  });

  it("deduplicates billing events by event id", async () => {
    const store =
      new InMemoryBillingIdempotencyStore();

    const event = {
      eventId: "evt_1",
      eventType:
        "subscription.updated",
      occurredAt: 1_700_000_000,
      customerId: "cus_1",
      subscriptionId: "sub_1",
      payloadHash:
        hashBillingPayload('{"ok":true}'),
    };

    const first =
      await beginBillingEvent(
        store,
        event,
      );

    expect(first.status).toBe("new");

    await markBillingEventProcessed(
      store,
      event,
      1_700_000_001,
    );

    const second =
      await beginBillingEvent(
        store,
        event,
      );

    expect(second.status).toBe(
      "duplicate",
    );
  });

  it("supports reservation, commit and release semantics", async () => {
    const store =
      new InMemoryUsageStore();

    const scope = {
      accountId: "account_1",
      userId: "user_1",
      capability:
        "buyer_intelligence",
      periodKey: "2026-10",
    };

    const reservationId =
      "reservation_1";

    const reserved =
      await store.reserve({
        scope,
        reservation: {
          reservationId,
          amount: 1,
          reservedAt:
            1_700_000_000,
          expiresAt:
            1_700_100_000,
        },
      });

    expect(reserved.accepted).toBe(
      true,
    );

    expect(
      reserved.record.reserved,
    ).toBe(1);

    const committed =
      await store.commit({
        scope,
        reservationId,
        amount: 1,
      });

    expect(committed.committed).toBe(
      true,
    );

    expect(
      committed.record.committed,
    ).toBe(1);
  });

  it("enforces account and IP abuse limits", () => {
    const abuse =
      new InMemoryAbuseController({
        accountPerWindow: 2,
        ipPerWindow: 2,
        devicePerWindow: 10,
        windowSeconds: 60,
      });

    const metadata =
      normalizeRequestIdentityMetadata({
        ip: "198.51.100.10",
        deviceFingerprint:
          "device-a",
      });

    const first = abuse.check(
      "account_1",
      metadata,
      1000,
    );

    const second = abuse.check(
      "account_1",
      metadata,
      1001,
    );

    const third = abuse.check(
      "account_1",
      metadata,
      1002,
    );

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);

    if (!third.allowed) {
      expect(third.reason).toBe(
        "account_rate_limit",
      );
    }
  });

  it("does not declare production ready without persistent authorities", () => {
    const result =
      evaluateV15Readiness({
        environment:
          "production",
        persistentSubscriptionStore:
          false,
        persistentUsageStore:
          false,
        persistentIdempotencyStore:
          false,
        authenticatedIdentityProvider:
          false,
        billingWebhookSecret:
          false,
        abuseStore:
          false,
      });

    expect(result.ready).toBe(
      false,
    );

    expect(
      result.blockers.length,
    ).toBeGreaterThan(0);
  });

  it("declares the architecture ready in tests when all authorities exist", () => {
    const result =
      evaluateV15Readiness({
        environment:
          "test",
        persistentSubscriptionStore:
          false,
        persistentUsageStore:
          false,
        persistentIdempotencyStore:
          false,
        authenticatedIdentityProvider:
          false,
        billingWebhookSecret:
          false,
        abuseStore:
          false,
      });

    expect(result.ready).toBe(
      true,
    );
  });

  it("provides a real subscription store abstraction", async () => {
    const store =
      new InMemorySubscriptionStore();

    await store.upsert(
      subscription,
    );

    expect(
      await store.getByAccountId(
        "account_1",
      ),
    ).toEqual(subscription);

    expect(
      await store.getBySubscriptionId(
        "sub_1",
      ),
    ).toEqual(subscription);
  });
});
