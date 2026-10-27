import "server-only";

import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";

import type {
  VerifiedAuthSession,
} from "./v16-identity-authority";

export type OidcConfig = {
  provider: string;
  issuer: string;
  audience: string;
  jwksUrl: string;
};

const PROVIDER_ID = /^[A-Za-z0-9._:-]{1,160}$/;

function secureUrl(value: string): URL | null {
  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function validateOidcConfig(
  config: OidcConfig,
): boolean {
  const issuer = secureUrl(config.issuer);
  const jwks = secureUrl(config.jwksUrl);

  return (
    PROVIDER_ID.test(config.provider) &&
    issuer !== null &&
    jwks !== null &&
    !issuer.search &&
    !issuer.hash &&
    config.audience.trim().length > 0 &&
    config.audience.trim() === config.audience
  );
}

/**
 * Only server-side configuration supplies the trust anchors.
 * A JWT's own header must never choose its verification URL.
 */
export function configuredOidc(): OidcConfig | null {
  const config: OidcConfig = {
    provider: process.env.ECC_OIDC_PROVIDER ?? "",
    issuer: process.env.ECC_OIDC_ISSUER ?? "",
    audience: process.env.ECC_OIDC_AUDIENCE ?? "",
    jwksUrl: process.env.ECC_OIDC_JWKS_URL ?? "",
  };

  return validateOidcConfig(config) ? config : null;
}

/**
 * Cryptographic verification with an injected trusted key resolver.
 * Exported separately so security tests can use local signing keys
 * without making real HTTP requests.
 */
export async function verifySignedAccessToken(
  token: string | null,
  config: OidcConfig,
  trustedKeys: JWTVerifyGetKey,
): Promise<VerifiedAuthSession | null> {
  if (
    !token ||
    token.length > 16384 ||
    !validateOidcConfig(config)
  ) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      trustedKeys,
      {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ["RS256"],
        maxTokenAge: "15m",
        clockTolerance: 5,
      },
    );

    const now = Math.floor(Date.now() / 1000);

    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      payload.sub.length > 255 ||
      /[\u0000-\u001f\u007f]/.test(payload.sub) ||
      typeof payload.iat !== "number" ||
      !Number.isSafeInteger(payload.iat) ||
      payload.iat > now + 5 ||
      typeof payload.exp !== "number" ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= now ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > 900
    ) {
      return null;
    }

    return {
      provider: config.provider,
      externalSubject: payload.sub,
      issuedAt: payload.iat,
    };
  } catch {
    // Invalid signatures, expired tokens and JWKS failures deny access.
    return null;
  }
}

let cachedRemote:
  | {
      url: string;
      keys: ReturnType<typeof createRemoteJWKSet>;
    }
  | null = null;

/**
 * Verifies a provider-issued JWT access token.
 * No configured provider = no identity.
 *
 * This does NOT authenticate arbitrary browser cookies,
 * implement an OIDC login flow, or activate paid routes.
 */
export async function verifyConfiguredOidcToken(
  token: string | null,
): Promise<VerifiedAuthSession | null> {
  const config = configuredOidc();

  if (!config || !token) {
    return null;
  }

  if (
    !cachedRemote ||
    cachedRemote.url !== config.jwksUrl
  ) {
    cachedRemote = {
      url: config.jwksUrl,
      keys: createRemoteJWKSet(
        new URL(config.jwksUrl),
        {
          timeoutDuration: 5000,
          cooldownDuration: 30000,
        },
      ),
    };
  }

  return verifySignedAccessToken(
    token,
    config,
    cachedRemote.keys,
  );
}
