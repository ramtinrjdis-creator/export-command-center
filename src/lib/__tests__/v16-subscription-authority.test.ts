import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../commercial/v16-auth-pipeline", () => ({
  authenticateAccountRequest: vi.fn(),
}));

import { authenticateAccountRequest } from "../commercial/v16-auth-pipeline";
import { authorizeSubscribedAccount } from "../commercial/v16-subscription-authority";
import type { SubscriptionStore } from "../commercial/v15-subscription-store";

const authenticate = vi.mocked(authenticateAccountRequest);
const NOW = 1800000000;

const identity = {
  userId: "user-1",
  accountId: "account-1",
  authenticated: true as const,
  issuedAt: NOW - 100,
  source: "ecc-primary-oidc",
};

const subscription = {
  subscriptionId: "sub-1",
  customerId: "customer-1",
  accountId: "account-1",
  state: "active" as const,
  planId: "pro",
  entitlementIds: ["buyer_intelligence"],
  currentPeriodStart: NOW - 1000,
  currentPeriodEnd: NOW + 1000,
  cancelAtPeriodEnd: false,
  updatedAt: NOW,
  source: "verified-billing",
};

const getByAccountId = vi.fn();

const store = {
  getByAccountId,
  getBySubscriptionId: vi.fn(),
  upsert: vi.fn(),
} as unknown as SubscriptionStore;

const input = {
  authorization: "Bearer verified.jwt.signature",
  accountId: "account-1",
  requiredEntitlement: "buyer_intelligence",
  subscriptionStore: store,
  now: NOW,
};

describe("V16.7 subscription authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticate.mockResolvedValue(identity);
    getByAccountId.mockResolvedValue(subscription);
  });

  it("permits verified identity with active entitlement", async () => {
    const result = await authorizeSubscribedAccount(input);
    expect(result.allowed).toBe(true);
    expect(getByAccountId).toHaveBeenCalledWith("account-1");
  });

  it("rejects unauthenticated requests before database lookup", async () => {
    authenticate.mockResolvedValueOnce(null);
    const result = await authorizeSubscribedAccount(input);
    expect(result.allowed).toBe(false);
    expect(getByAccountId).not.toHaveBeenCalled();
  });

  it("rejects missing subscriptions", async () => {
    getByAccountId.mockResolvedValueOnce(null);
    const result = await authorizeSubscribedAccount(input);
    expect(result).toMatchObject({
      allowed: false,
      code: "subscription_required",
    });
  });

  it("rejects subscriptions belonging to another account", async () => {
    getByAccountId.mockResolvedValueOnce({
      ...subscription,
      accountId: "account-2",
    });
    const result = await authorizeSubscribedAccount(input);
    expect(result).toMatchObject({
      allowed: false,
      code: "account_mismatch",
    });
  });

  it("rejects missing entitlement", async () => {
    getByAccountId.mockResolvedValueOnce({
      ...subscription,
      entitlementIds: [],
    });
    const result = await authorizeSubscribedAccount(input);
    expect(result).toMatchObject({
      allowed: false,
      code: "entitlement_missing",
    });
  });

  it("fails closed if subscription storage throws", async () => {
    getByAccountId.mockRejectedValueOnce(
      new Error("database_unavailable"),
    );
    const result = await authorizeSubscribedAccount(input);
    expect(result).toMatchObject({
      allowed: false,
      code: "production_storage_unavailable",
    });
  });
});
