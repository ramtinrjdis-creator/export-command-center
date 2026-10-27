import "server-only";

import {
  verifyConfiguredOidcToken,
} from "./v16-oidc-adapter";

import {
  resolveAccountIdentity,
} from "./v16-identity-authority";

import {
  validateTrustedIdentity,
} from "./v15-identity";

import type {
  TrustedIdentity,
} from "./v15-types";

const SAFE_ACCOUNT_ID = /^[A-Za-z0-9._:-]{1,160}$/;

function extractBearerToken(
  authorization: string | null,
): string | null {
  if (
    !authorization ||
    authorization.length > 16400
  ) {
    return null;
  }

  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(
    authorization,
  );

  return match?.[1] ?? null;
}

/**
 * Server-side authentication and account-membership boundary.
 *
 * Authorization is a candidate credential, never proof by itself.
 *
 * Account selection is also untrusted. PostgreSQL must confirm
 * membership against the cryptographically verified subject.
 *
 * Any authentication or persistence failure denies access.
 *
 * This module does NOT authorize subscription privileges,
 * issue tokens, implement login, or enable the paid provider.
 */
export async function authenticateAccountRequest(input: {
  authorization: string | null;
  accountId: string;
}): Promise<TrustedIdentity | null> {
  if (!SAFE_ACCOUNT_ID.test(input.accountId)) {
    return null;
  }

  const token = extractBearerToken(input.authorization);

  if (!token) {
    return null;
  }

  try {
    const session = await verifyConfiguredOidcToken(token);

    if (!session) {
      return null;
    }

    const identity = await resolveAccountIdentity({
      accountId: input.accountId,
      verifySession: async () => session,
    });

    const validated = validateTrustedIdentity(identity);

    if (
      !validated ||
      validated.accountId !== input.accountId ||
      validated.source !== session.provider
    ) {
      return null;
    }

    return validated;
  } catch {
    // Auth provider, JWKS, or database failure: fail closed.
    return null;
  }
}
