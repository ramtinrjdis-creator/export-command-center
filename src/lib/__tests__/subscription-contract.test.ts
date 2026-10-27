import { describe, expect, it } from "vitest";
import {
  validateSubscription,
  type SubscriptionRecord,
} from "../commercial/subscription-contract";

const base: SubscriptionRecord = {
  userId: "user-1",
  subscriptionId: "sub-1",
  customerId: "cus-1",
  provider: "test-billing",
  plan: "pro_monthly",
  status: "active",
  currentPeriodStart: "2026-10-01T00:00:00.000Z",
  currentPeriodEnd: "2026-11-01T00:00:00.000Z",
  entitlementVersion: 1,
};

describe("subscription contract", () => {
  it("accepts a valid monthly period", () => {
    const result = validateSubscription(
      base,
      Date.parse("2026-10-08T00:00:00.000Z"),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects an expired monthly period", () => {
    const result = validateSubscription(
      base,
      Date.parse("2026-11-02T00:00:00.000Z"),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("period_expired");
  });

  it("rejects annual access hidden inside a monthly plan", () => {
    const result = validateSubscription(
      {
        ...base,
        currentPeriodEnd: "2027-10-01T00:00:00.000Z",
      },
      Date.parse("2026-10-08T00:00:00.000Z"),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("billing_period_does_not_match_plan");
    }
  });

  it("rejects canceled access even while dates remain open", () => {
    const result = validateSubscription(
      {
        ...base,
        status: "canceled",
      },
      Date.parse("2026-10-08T00:00:00.000Z"),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("subscription_not_active");
  });

  it("rejects free plan from receiving paid access", () => {
    const result = validateSubscription(
      {
        ...base,
        plan: "free",
      },
      Date.parse("2026-10-08T00:00:00.000Z"),
    );
    expect(result.valid).toBe(false);
  });
});
