import { describe, expect, it } from "vitest";
import { assertBillingEventShape } from "../commercial/billing-provider";

describe("billing provider boundary", () => {
  it("accepts a normalized event", () => {
    expect(
      assertBillingEventShape({
        provider: "billing-test",
        eventId: "evt-1",
        type: "subscription_created",
        receivedAt: "2026-10-08T00:00:00.000Z",
        subscription: {
          userId: "user-1",
          subscriptionId: "sub-1",
          customerId: "cus-1",
          provider: "billing-test",
          plan: "pro_monthly",
          status: "active",
          currentPeriodStart: "2026-10-01T00:00:00.000Z",
          currentPeriodEnd: "2026-11-01T00:00:00.000Z",
          entitlementVersion: 1,
        },
      }),
    ).toBe(true);
  });

  it("rejects a billing event with no provider identity", () => {
    expect(() =>
      assertBillingEventShape({
        provider: "",
        eventId: "evt-1",
        type: "subscription_created",
        receivedAt: "2026-10-08T00:00:00.000Z",
        subscription: {
          userId: "user-1",
          subscriptionId: "sub-1",
          customerId: "cus-1",
          provider: "billing-test",
          plan: "pro_monthly",
          status: "active",
          currentPeriodStart: "2026-10-01T00:00:00.000Z",
          currentPeriodEnd: "2026-11-01T00:00:00.000Z",
          entitlementVersion: 1,
        },
      }),
    ).toThrow("billing_provider_missing");
  });
});
