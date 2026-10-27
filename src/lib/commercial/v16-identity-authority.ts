import "server-only";

import {
  query,
} from "../persistence/postgres";

import {
  validateTrustedIdentity,
} from "./v15-identity";

import type {
  TrustedIdentity,
} from "./v15-types";

/**
 * An authentication adapter must establish this session
 * by validating provider-controlled credentials server-side.
 *
 * Never construct this object from arbitrary request headers,
 * URL parameters or unverified client JSON.
 */
export type VerifiedAuthSession = {
  externalSubject: string;
  provider: string;
  issuedAt: number;
};

export type ServerSessionVerifier =
  () => Promise<VerifiedAuthSession | null>;

const ACCOUNT_ID = /^[A-Za-z0-9._:-]{1,160}$/;

function validSession(
  session: VerifiedAuthSession | null,
): session is VerifiedAuthSession {
  if (!session) return false;

  if (
    typeof session.externalSubject !== "string" ||
    session.externalSubject.length < 1 ||
    session.externalSubject.length > 255 ||
    /[\u0000-\u001f\u007f]/.test(session.externalSubject)
  ) {
    return false;
  }

  if (
    typeof session.provider !== "string" ||
    !ACCOUNT_ID.test(session.provider)
  ) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);

  return (
    Number.isSafeInteger(session.issuedAt) &&
    session.issuedAt > 0 &&
    session.issuedAt <= now
  );
}

/**
 * The accountId identifies the requested account; it is NOT
 * proof of membership.
 *
 * Account membership is established exclusively by PostgreSQL.
 *
 * Database failures propagate to the caller. A caller must
 * deny paid access on any failure; never fall back to a
 * client-provided identity.
 */
export async function resolveAccountIdentity(input: {
  verifySession: ServerSessionVerifier;
  accountId: string;
}): Promise<TrustedIdentity | null> {
  if (!ACCOUNT_ID.test(input.accountId)) {
    return null;
  }

  const session = await input.verifySession();

  if (!validSession(session)) {
    return null;
  }

  const result = await query<{
    user_id: string;
    account_id: string;
  }>(
    `
    SELECT
      u.id AS user_id,
      m.account_id
    FROM ecc_auth_identities AS auth
    INNER JOIN ecc_users AS u
      ON u.id = auth.user_id
    INNER JOIN ecc_account_members AS m
      ON m.user_id = u.id
    INNER JOIN ecc_accounts AS a
      ON a.id = m.account_id
    WHERE auth.provider = $1
      AND auth.external_subject = $2
      AND m.account_id = $3
    LIMIT 1
    `,
    [
      session.provider,
      session.externalSubject,
      input.accountId,
    ],
  );

  const member = result.rows[0];

  if (!member) {
    return null;
  }

  return validateTrustedIdentity({
    userId: member.user_id,
    accountId: member.account_id,
    authenticated: true,
    issuedAt: session.issuedAt,
    source: session.provider,
  });
}
