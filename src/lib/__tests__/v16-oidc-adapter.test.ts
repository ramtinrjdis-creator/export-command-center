import {
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
} from "jose";

import {
  validateOidcConfig,
  verifySignedAccessToken,
  type OidcConfig,
} from "../commercial/v16-oidc-adapter";

const config: OidcConfig = {
  provider: "ecc-primary-oidc",
  issuer: "https://auth.example.test/",
  audience: "ecc-api",
  jwksUrl: "https://auth.example.test/keys",
};

let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;
let trustedKeys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const primary = await generateKeyPair("RS256", {
    extractable: true,
  });

  const other = await generateKeyPair("RS256", {
    extractable: true,
  });

  privateKey = primary.privateKey;
  otherPrivateKey = other.privateKey;

  const publicJwk = await exportJWK(primary.publicKey);

  trustedKeys = createLocalJWKSet({
    keys: [{
      ...publicJwk,
      alg: "RS256",
      use: "sig",
      kid: "ecc-test-key",
    }],
  });
});

async function signedToken(
  overrides: {
    issuer?: string;
    audience?: string;
    issuedAt?: number;
    expiresAt?: number;
    subject?: string;
    key?: CryptoKey;
  } = {},
) {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({
      alg: "RS256",
      kid: "ecc-test-key",
    })
    .setIssuer(overrides.issuer ?? config.issuer)
    .setAudience(overrides.audience ?? config.audience)
    .setSubject(overrides.subject ?? "user-123")
    .setIssuedAt(overrides.issuedAt ?? now - 10)
    .setExpirationTime(overrides.expiresAt ?? now + 600)
    .sign(overrides.key ?? privateKey);
}

describe("V16.5 signed OIDC access-token verifier", () => {
  it("accepts a correctly signed token with pinned claims", async () => {
    const result = await verifySignedAccessToken(
      await signedToken(),
      config,
      trustedKeys,
    );

    expect(result).toMatchObject({
      provider: "ecc-primary-oidc",
      externalSubject: "user-123",
    });
  });

  it("rejects a signature from an untrusted key", async () => {
    expect(await verifySignedAccessToken(
      await signedToken({ key: otherPrivateKey }),
      config,
      trustedKeys,
    )).toBeNull();
  });

  it("rejects an incorrect issuer", async () => {
    expect(await verifySignedAccessToken(
      await signedToken({
        issuer: "https://different.example.test/",
      }),
      config,
      trustedKeys,
    )).toBeNull();
  });

  it("rejects an incorrect audience", async () => {
    expect(await verifySignedAccessToken(
      await signedToken({ audience: "another-api" }),
      config,
      trustedKeys,
    )).toBeNull();
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);

    expect(await verifySignedAccessToken(
      await signedToken({
        issuedAt: now - 120,
        expiresAt: now - 30,
      }),
      config,
      trustedKeys,
    )).toBeNull();
  });

  it("rejects excessive token lifetime", async () => {
    const now = Math.floor(Date.now() / 1000);

    expect(await verifySignedAccessToken(
      await signedToken({
        issuedAt: now - 10,
        expiresAt: now + 3600,
      }),
      config,
      trustedKeys,
    )).toBeNull();
  });

  it("rejects missing tokens and malformed configuration", async () => {
    expect(await verifySignedAccessToken(
      null,
      config,
      trustedKeys,
    )).toBeNull();

    expect(validateOidcConfig({
      ...config,
      jwksUrl: "http://localhost/keys",
    })).toBe(false);

    expect(validateOidcConfig({
      ...config,
      provider: "invalid provider",
    })).toBe(false);
  });
});
