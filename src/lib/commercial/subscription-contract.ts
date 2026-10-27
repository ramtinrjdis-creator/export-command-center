export type SubscriptionPlan =
  | "free"
  | "pro_monthly"
  | "pro_yearly";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired"
  | "revoked";

export type SubscriptionRecord = {
  userId: string;
  subscriptionId: string;
  customerId: string;
  provider: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  entitlementVersion: number;
};

export type SubscriptionValidation =
  | { valid: true; remainingMs: number }
  | { valid: false; reason: string };

const MONTH_MIN_DAYS = 27;
const MONTH_MAX_DAYS = 40;
const YEAR_MIN_DAYS = 330;
const YEAR_MAX_DAYS = 400;

function ms(value: string) {
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

function periodIsSane(
  plan: SubscriptionPlan,
  startMs: number,
  endMs: number,
) {
  const days = (endMs - startMs) / 86_400_000;

  if (plan === "pro_monthly") {
    return days >= MONTH_MIN_DAYS && days <= MONTH_MAX_DAYS;
  }

  if (plan === "pro_yearly") {
    return days >= YEAR_MIN_DAYS && days <= YEAR_MAX_DAYS;
  }

  return true;
}

export function validateSubscription(
  subscription: SubscriptionRecord,
  nowMs = Date.now(),
): SubscriptionValidation {
  if (!subscription.userId.trim()) {
    return { valid: false, reason: "missing_user_id" };
  }

  if (!subscription.subscriptionId.trim()) {
    return { valid: false, reason: "missing_subscription_id" };
  }

  if (!subscription.customerId.trim()) {
    return { valid: false, reason: "missing_customer_id" };
  }

  if (!subscription.provider.trim()) {
    return { valid: false, reason: "missing_provider" };
  }

  if (
    subscription.plan === "free" ||
    subscription.status === "expired" ||
    subscription.status === "revoked"
  ) {
    return { valid: false, reason: "inactive_plan" };
  }

  if (
    subscription.status !== "active" &&
    subscription.status !== "trialing"
  ) {
    return { valid: false, reason: "subscription_not_active" };
  }

  const start = ms(subscription.currentPeriodStart);
  const end = ms(subscription.currentPeriodEnd);

  if (start === null || end === null || end <= start) {
    return { valid: false, reason: "invalid_billing_period" };
  }

  if (!periodIsSane(subscription.plan, start, end)) {
    return { valid: false, reason: "billing_period_does_not_match_plan" };
  }

  if (nowMs < start) {
    return { valid: false, reason: "period_not_started" };
  }

  if (nowMs >= end) {
    return { valid: false, reason: "period_expired" };
  }

  return {
    valid: true,
    remainingMs: end - nowMs,
  };
}
