import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../persistence/postgres", () => ({
  query: vi.fn(),
}));

import { query } from "../persistence/postgres";
import {
  claimProviderExecution,
  transitionProviderExecution,
} from "../persistence/provider-execution";

const db = vi.mocked(query);
const claim = {
  executionId: "exec-1",
  reservationId: "res-1",
  accountId: "account-1",
  userId: "user-1",
  provider: "provider-1",
  requestHash: "a".repeat(64),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("V16.8E durable provider execution", () => {
  it("permits dispatch only for a newly inserted claim", async () => {
    db.mockResolvedValueOnce({
      rows: [{ status: "pending" }],
    } as never);

    expect(await claimProviderExecution(claim)).toEqual({
      created: true,
      status: "pending",
    });

    const sql = String(db.mock.calls[0][0]);
    expect(sql).toContain("r.status = 'reserved'");
    expect(sql).toContain("ON CONFLICT DO NOTHING");
  });

  it("never redispatches an existing pending operation", async () => {
    db.mockResolvedValueOnce({ rows: [] } as never);
    db.mockResolvedValueOnce({
      rows: [{
        execution_id: claim.executionId,
        reservation_id: claim.reservationId,
        account_id: claim.accountId,
        user_id: claim.userId,
        provider: claim.provider,
        request_hash: claim.requestHash,
        status: "pending",
      }],
    } as never);

    expect(await claimProviderExecution(claim)).toEqual({
      created: false,
      status: "pending",
    });
  });

  it("rejects conflicting execution identities", async () => {
    db.mockResolvedValueOnce({ rows: [] } as never);
    db.mockResolvedValueOnce({
      rows: [{
        execution_id: claim.executionId,
        reservation_id: claim.reservationId,
        account_id: claim.accountId,
        user_id: "another-user",
        provider: claim.provider,
        request_hash: claim.requestHash,
        status: "pending",
      }],
    } as never);

    await expect(claimProviderExecution(claim))
      .rejects.toThrow("provider_execution_identity_conflict");
  });

  it("does not dispatch when no reserved operation exists", async () => {
    db.mockResolvedValueOnce({ rows: [] } as never);
    db.mockResolvedValueOnce({ rows: [] } as never);

    expect(await claimProviderExecution(claim)).toEqual({
      created: false,
      status: null,
    });
  });

  it("fails closed on a database outage", async () => {
    db.mockRejectedValueOnce(new Error("database_unavailable"));

    await expect(claimProviderExecution(claim))
      .rejects.toThrow("database_unavailable");
  });

  it("transitions only pending executions", async () => {
    db.mockResolvedValueOnce({ rowCount: 1 } as never);

    expect(await transitionProviderExecution({
      executionId: "exec-1",
      nextStatus: "reconciliation_required",
    })).toBe(true);

    expect(String(db.mock.calls[0][0]))
      .toContain("AND status = 'pending'");
  });

  it("prevents repeated finalization", async () => {
    db.mockResolvedValueOnce({ rowCount: 0 } as never);

    expect(await transitionProviderExecution({
      executionId: "exec-1",
      nextStatus: "reconciliation_required",
    })).toBe(false);
  });

  it("rejects invalid request hashes", async () => {
    await expect(claimProviderExecution({
      ...claim,
      requestHash: "not-a-hash",
    })).rejects.toThrow("invalid_provider_execution_claim");

    expect(db).not.toHaveBeenCalled();
  });
});
