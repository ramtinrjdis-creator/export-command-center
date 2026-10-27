import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../persistence/postgres", () => ({
  query: vi.fn(),
}));

import { query } from "../persistence/postgres";
import {
  resolveAccountIdentity,
  type VerifiedAuthSession,
} from "../commercial/v16-identity-authority";

const mockQuery = vi.mocked(query);
const NOW = Math.floor(Date.now() / 1000);

const session: VerifiedAuthSession = {
  provider: "provider-one",
  externalSubject: "subject-123",
  issuedAt: NOW - 30,
};

const verifySession = vi.fn(async () => session);

describe("V16.4 provider-scoped identity authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifySession.mockResolvedValue(session);
    mockQuery.mockResolvedValue({
      rows: [],
    } as never);
  });

  it("rejects missing authentication without querying DB", async () => {
    verifySession.mockResolvedValueOnce(null as never);

    expect(await resolveAccountIdentity({
      verifySession,
      accountId: "account-1",
    })).toBeNull();

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects an invalid account before session or DB lookup", async () => {
    expect(await resolveAccountIdentity({
      verifySession,
      accountId: "account 1",
    })).toBeNull();

    expect(verifySession).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects a future-issued session", async () => {
    verifySession.mockResolvedValueOnce({
      ...session,
      issuedAt: NOW + 3600,
    });

    expect(await resolveAccountIdentity({
      verifySession,
      accountId: "account-1",
    })).toBeNull();

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("uses provider, subject, and account as separate SQL parameters", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        user_id: "user-1",
        account_id: "account-1",
      }],
    } as never);

    const identity = await resolveAccountIdentity({
      verifySession,
      accountId: "account-1",
    });

    expect(identity).toMatchObject({
      userId: "user-1",
      accountId: "account-1",
      authenticated: true,
      source: "provider-one",
    });

    const [sql, params] = mockQuery.mock.calls[0];

    expect(sql).toContain("ecc_auth_identities");
    expect(sql).toContain("auth.provider = $1");
    expect(sql).toContain("auth.external_subject = $2");
    expect(sql).toContain("m.account_id = $3");

    expect(params).toEqual([
      "provider-one",
      "subject-123",
      "account-1",
    ]);
  });

  it("does not grant access without a matching membership", async () => {
    expect(await resolveAccountIdentity({
      verifySession,
      accountId: "another-account",
    })).toBeNull();
  });

  it("keeps identical subjects isolated by provider", async () => {
    verifySession.mockResolvedValueOnce({
      ...session,
      provider: "provider-two",
    });

    expect(await resolveAccountIdentity({
      verifySession,
      accountId: "account-1",
    })).toBeNull();

    expect(mockQuery.mock.calls[0][1]).toEqual([
      "provider-two",
      "subject-123",
      "account-1",
    ]);
  });

  it("propagates database failures rather than fabricating identity", async () => {
    mockQuery.mockRejectedValueOnce(
      new Error("database_unavailable"),
    );

    await expect(resolveAccountIdentity({
      verifySession,
      accountId: "account-1",
    })).rejects.toThrow("database_unavailable");
  });

  it("rejects malformed identity returned from DB", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        user_id: "invalid user",
        account_id: "account-1",
      }],
    } as never);

    expect(await resolveAccountIdentity({
      verifySession,
      accountId: "account-1",
    })).toBeNull();
  });
});
