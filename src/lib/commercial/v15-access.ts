import {
  randomUUID,
} from "node:crypto";

import {
  validateTrustedIdentity,
} from "./v15-identity";

import type {
  AbuseDecision,
  RequestIdentityMetadata,
  ServerAccessDecision,
  SubscriptionSnapshot,
  TrustedIdentity,
} from "./v15-types";

const ACTIVE_STATES = new Set([
  "active",
  "trialing",
]);

function validPeriod(
  subscription: SubscriptionSnapshot,
): boolean {
  return (
    Number.isFinite(
      subscription.currentPeriodStart,
    ) &&
    Number.isFinite(
      subscription.currentPeriodEnd,
    ) &&
    subscription.currentPeriodStart <
      subscription.currentPeriodEnd
  );
}

export function evaluateServerEntitlement(input: {
  identity:
    | TrustedIdentity
    | null
    | undefined;
  subscription:
    | SubscriptionSnapshot
    | null
    | undefined;
  requiredEntitlement: string;
  now?: number;
}): ServerAccessDecision {
  const now =
    input.now ?? Math.floor(Date.now() / 1000);

  const identity = validateTrustedIdentity(
    input.identity,
  );

  if (!identity) {
    return {
      allowed: false,
      code: "identity_required",
      message:
        "Authenticated server identity is required.",
    };
  }

  if (!input.subscription) {
    return {
      allowed: false,
      code: "subscription_required",
      message:
        "No authoritative subscription record is available.",
    };
  }

  if (
    input.subscription.accountId !==
    identity.accountId
  ) {
    return {
      allowed: false,
      code: "account_mismatch",
      message:
        "Subscription does not belong to the authenticated account.",
    };
  }

  if (
    !ACTIVE_STATES.has(
      input.subscription.state,
    )
  ) {
    return {
      allowed: false,
      code: "subscription_inactive",
      message:
        "Subscription is not active for Pro access.",
    };
  }

  if (!validPeriod(input.subscription)) {
    return {
      allowed: false,
      code: "invalid_subscription_period",
      message:
        "Subscription period is invalid.",
    };
  }

  if (
    now <
      input.subscription
        .currentPeriodStart
  ) {
    return {
      allowed: false,
      code: "subscription_inactive",
      message:
        "Subscription period has not started.",
    };
  }

  if (
    now >=
    input.subscription.currentPeriodEnd
  ) {
    return {
      allowed: false,
      code: "subscription_expired",
      message:
        "Subscription period has expired.",
    };
  }

  if (
    !input.subscription.entitlementIds.includes(
      input.requiredEntitlement,
    )
  ) {
    return {
      allowed: false,
      code: "entitlement_missing",
      message:
        "Required entitlement is not present.",
    };
  }

  return {
    allowed: true,
    userId: identity.userId,
    accountId: identity.accountId,
    entitlement:
      input.requiredEntitlement,
    subscriptionId:
      input.subscription.subscriptionId,
    planId: input.subscription.planId,
    expiresAt:
      input.subscription.currentPeriodEnd,
    evaluatedAt: now,
  };
}

export function createUsageReservationId(): string {
  return `usr_${randomUUID()}`;
}

type WindowRecord = {
  count: number;
  windowStartedAt: number;
};

export class InMemoryAbuseController {
  private readonly account =
    new Map<string, WindowRecord>();

  private readonly ip =
    new Map<string, WindowRecord>();

  private readonly device =
    new Map<string, WindowRecord>();

  constructor(
    private readonly limits: {
      accountPerWindow: number;
      ipPerWindow: number;
      devicePerWindow: number;
      windowSeconds: number;
    } = {
      accountPerWindow: 120,
      ipPerWindow: 180,
      devicePerWindow: 120,
      windowSeconds: 3600,
    },
  ) {}

  private evaluate(
    map: Map<string, WindowRecord>,
    key: string,
    limit: number,
    now: number,
  ): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    const current = map.get(key);

    if (
      !current ||
      now - current.windowStartedAt >=
        this.limits.windowSeconds
    ) {
      map.set(key, {
        count: 1,
        windowStartedAt: now,
      });

      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        resetAt:
          now + this.limits.windowSeconds,
      };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt:
          current.windowStartedAt +
          this.limits.windowSeconds,
      };
    }

    current.count += 1;

    return {
      allowed: true,
      remaining: Math.max(
        0,
        limit - current.count,
      ),
      resetAt:
        current.windowStartedAt +
        this.limits.windowSeconds,
    };
  }

  check(
    accountId: string,
    metadata: RequestIdentityMetadata,
    now = Math.floor(Date.now() / 1000),
  ): AbuseDecision {
    const account = this.evaluate(
      this.account,
      accountId,
      this.limits.accountPerWindow,
      now,
    );

    if (!account.allowed) {
      return {
        allowed: false,
        key: `account:${accountId}`,
        reason: "account_rate_limit",
        resetAt: account.resetAt,
      };
    }

    if (metadata.ip) {
      const ip = this.evaluate(
        this.ip,
        metadata.ip,
        this.limits.ipPerWindow,
        now,
      );

      if (!ip.allowed) {
        return {
          allowed: false,
          key: `ip:${metadata.ip}`,
          reason: "ip_rate_limit",
          resetAt: ip.resetAt,
        };
      }
    }

    if (metadata.deviceFingerprint) {
      const device =
        this.evaluate(
          this.device,
          metadata.deviceFingerprint,
          this.limits.devicePerWindow,
          now,
        );

      if (!device.allowed) {
        return {
          allowed: false,
          key: `device:${metadata.deviceFingerprint}`,
          reason: "device_rate_limit",
          resetAt: device.resetAt,
        };
      }
    }

    return {
      allowed: true,
      key: `account:${accountId}`,
      remaining: account.remaining,
      resetAt: account.resetAt,
    };
  }
}
