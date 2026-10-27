import "server-only";

import { authenticateAccountRequest } from "./v16-auth-pipeline";
import { evaluateServerEntitlement } from "./v15-access";
import type { SubscriptionStore } from "./v15-subscription-store";
import type { ServerAccessDecision } from "./v15-types";

const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;

function deny(
  code: "identity_required" | "production_storage_unavailable",
): ServerAccessDecision {
  return {
    allowed: false,
    code,
    message: "Authoritative commercial access could not be established.",
  };
}

/**
 * Authentication + live subscription authorization.
 *
 * Store must be supplied by trusted server composition, never
 * constructed from client input or replaced with an in-memory
 * store for production.
 *
 * This is not the final paid execution gate:
 * durable abuse checks and usage reservations are still required.
 */
export async function authorizeSubscribedAccount(input: {
  authorization: string | null;
  accountId: string;
  requiredEntitlement: string;
  subscriptionStore: SubscriptionStore;
  now?: number;
}): Promise<ServerAccessDecision> {
  if (
    !SAFE_ID.test(input.accountId) ||
    !SAFE_ID.test(input.requiredEntitlement)
  ) {
    return deny("identity_required");
  }

  try {
    const identity = await authenticateAccountRequest({
      authorization: input.authorization,
      accountId: input.accountId,
    });

    if (!identity) {
      return deny("identity_required");
    }

    if (!input.subscriptionStore) {
      return deny("production_storage_unavailable");
    }

    const subscription =
      await input.subscriptionStore.getByAccountId(identity.accountId);

    return evaluateServerEntitlement({
      identity,
      subscription,
      requiredEntitlement: input.requiredEntitlement,
      now: input.now,
    });
  } catch {
    return deny("production_storage_unavailable");
  }
}
