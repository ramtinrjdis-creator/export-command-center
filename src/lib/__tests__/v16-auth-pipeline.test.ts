import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../commercial/v16-oidc-adapter", () => ({
  verifyConfiguredOidcToken: vi.fn(),
}));

vi.mock("../commercial/v16-identity-authority", () => ({
  resolveAccountIdentity: vi.fn(),
}));

import {
  verifyConfiguredOidcToken,
} from "../commercial/v16-oidc-adapter";

import {
  resolveAccountIdentity,
} from "../commercial/v16-identity-authority";

import {
  authenticateAccountRequest,
} from "../commercial/v16-auth-pipeline";

const verify = vi.mocked(verifyConfiguredOidcToken);
const resolve = vi.mocked(resolveAccountIdentity);

const token = "header.payload.signature";

const session = {
  provider: "ecc-primary-oidc",
  externalSubject: "subject-123",
  issuedAt: Math.floor(Date.now() / 1000) - 30,
};

const identity = {
  userId: "user-1",
  accountId: "account-1",
  authenticated: true as const,
  issuedAt: session.issuedAt,
  source: session.provider,
};

const request = {
  authorization: `Bearer ${token}`,
  accountId: "account-1",
};

describe("V16.6 authenticated account pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    verify.mockResolvedValue(session);
    resolve.mockResolvedValue(identity);
  });

  it("rejects a missing Authorization header", async () => {
    expect(await authenticateAccountRequest({
      ...request,
      authorization: null,
    })).toBeNull();

    expect(verify).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("rejects an unsupported credential format", async () => {
    expect(await authenticateAccountRequest({
      ...request,
      authorization: "Basic abc123",
    })).toBeNull();

    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects malformed JWT input", async () => {
    expect(await authenticateAccountRequest({
      ...request,
      authorization: "Bearer not-a-jwt",
    })).toBeNull();

    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects invalid account identifiers before verification", async () => {
    expect(await authenticateAccountRequest({
      ...request,
      accountId: "account 1",
    })).toBeNull();

    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects a token rejected by the OIDC verifier", async () => {
    verify.mockResolvedValueOnce(null);

    expect(await authenticateAccountRequest(
      request,
    )).toBeNull();

    expect(resolve).not.toHaveBeenCalled();
  });

  it("rejects absent database membership", async () => {
    resolve.mockResolvedValueOnce(null);

    expect(await authenticateAccountRequest(
      request,
    )).toBeNull();
  });

  it("rejects an identity belonging to another account", async () => {
    resolve.mockResolvedValueOnce({
      ...identity,
      accountId: "account-2",
    });

    expect(await authenticateAccountRequest(
      request,
    )).toBeNull();
  });

  it("rejects a mismatched identity provider", async () => {
    resolve.mockResolvedValueOnce({
      ...identity,
      source: "another-provider",
    });

    expect(await authenticateAccountRequest(
      request,
    )).toBeNull();
  });

  it("fails closed when PostgreSQL is unavailable", async () => {
    resolve.mockRejectedValueOnce(
      new Error("database_unavailable"),
    );

    expect(await authenticateAccountRequest(
      request,
    )).toBeNull();
  });

  it("fails closed when token verification throws", async () => {
    verify.mockRejectedValueOnce(
      new Error("jwks_unavailable"),
    );

    expect(await authenticateAccountRequest(
      request,
    )).toBeNull();
  });

  it("returns identity only after verification and membership", async () => {
    const result = await authenticateAccountRequest(
      request,
    );

    expect(verify).toHaveBeenCalledWith(token);

    expect(resolve).toHaveBeenCalledWith({
      accountId: "account-1",
      verifySession: expect.any(Function),
    });

    expect(result).toEqual(identity);
  });
});
