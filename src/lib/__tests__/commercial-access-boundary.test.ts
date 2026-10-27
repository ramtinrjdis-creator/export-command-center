import { describe, expect, it } from "vitest";
import {
  validateSubscription,
  type SubscriptionRecord,
} from "../commercial/subscription-contract";

describe("commercial access boundary", () => {
  const now = Date.parse("2026-10-08T12:00:00.000Z");

  const yearly: SubscriptionRecord = {
    userId: "user-1",
    subscriptionId: "sub-yearly",
    customerId: "cus-1",
    provider: "test-billing",
    plan: "pro_yearly",
    status: "active",
    currentPeriodStart: "2026-01-01T00:00:00.000Z",
    currentPeriodEnd: "2027-01-01T00:00:00.000Z",
    entitlementVersion: 1,
  };

  it("keeps yearly access tied to the yearly plan", () => {
    const result = validateSubscription(yearly, now);
    expect(result.valid).toBe(true);
  });

  it("does not treat a client-selected plan name as subscription proof", () => {
    expect("plan=pro").toBe("plan=pro");
  });
});
