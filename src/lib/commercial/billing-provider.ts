import type {
  CommercialPlan,
} from "./plan-policy";
import type {
  SubscriptionRecord,
} from "./subscription-contract";

export type BillingEventType =
  | "subscription_created"
  | "subscription_updated"
  | "subscription_canceled"
  | "subscription_expired"
  | "payment_failed"
  | "payment_recovered";

export type NormalizedBillingEvent = {
  provider: string;
  eventId: string;
  type: BillingEventType;
  receivedAt: string;
  subscription: SubscriptionRecord;
};

export type BillingProvider = {
  name: string;
  verifyWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<NormalizedBillingEvent | null>;
  getSubscription(
    subscriptionId: string,
  ): Promise<SubscriptionRecord | null>;
  createCheckoutUrl(input: {
    userId: string;
    plan: Exclude<CommercialPlan, "free">;
  }): Promise<string>;
};

export function assertBillingEventShape(
  event: NormalizedBillingEvent,
) {
  if (!event.provider.trim()) {
    throw new Error("billing_provider_missing");
  }

  if (!event.eventId.trim()) {
    throw new Error("billing_event_id_missing");
  }

  if (!event.subscription.subscriptionId.trim()) {
    throw new Error("billing_subscription_id_missing");
  }

  return true;
}
