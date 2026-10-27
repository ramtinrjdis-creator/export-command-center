import type {
  RequestIdentityMetadata,
  TrustedIdentity,
} from "./v15-types";

const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;

export function validateTrustedIdentity(
  identity: TrustedIdentity | null | undefined,
): TrustedIdentity | null {
  if (!identity) {
    return null;
  }

  if (!identity.authenticated) {
    return null;
  }

  if (!SAFE_ID.test(identity.userId)) {
    return null;
  }

  if (!SAFE_ID.test(identity.accountId)) {
    return null;
  }

  if (!Number.isFinite(identity.issuedAt) || identity.issuedAt <= 0) {
    return null;
  }

  return {
    ...identity,
    userId: identity.userId.trim(),
    accountId: identity.accountId.trim(),
    source: identity.source.trim() || "unknown",
  };
}

export function normalizeRequestIdentityMetadata(input: {
  ip?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
}): RequestIdentityMetadata {
  return {
    ip: input.ip?.trim() || null,
    userAgent: input.userAgent?.trim() || null,
    deviceFingerprint: input.deviceFingerprint?.trim() || null,
  };
}

/**
 * Client-provided headers are metadata, NOT trusted identity.
 * Production authentication must establish TrustedIdentity server-side.
 */
export function isTrustedIdentity(
  value: TrustedIdentity | null | undefined,
): value is TrustedIdentity {
  return validateTrustedIdentity(value) !== null;
}
