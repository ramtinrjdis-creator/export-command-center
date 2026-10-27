import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../persistence/postgres", () => ({
  withTransaction: vi.fn(),
}));

import { withTransaction } from "../persistence/postgres";
import { settleProviderExecution } from "../persistence/provider-settlement";

const transaction = vi.mocked(withTransaction);
const db = vi.fn();

const base = {
  scope: {
    accountId: "account-1",
    userId: "user-1",
    capability: "buyer_intelligence",
    periodKey: "period-1",
  },
  reservationId: "res-1",
  executionId: "exec-1",
  outcome: "succeeded" as const,
  resultHash: "a".repeat(64),
};

let reservationStatus = "reserved";
let executionStatus = "pending";
let counterRows = 1;
let reservationUpdateRows = 1;
let executionUpdateRows = 1;

beforeEach(() => {
  vi.resetAllMocks();
  reservationStatus = "reserved";
  executionStatus = "pending";
  counterRows = 1;
  reservationUpdateRows = 1;
  executionUpdateRows = 1;

  db.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM ecc_usage_reservations")) {
      return {
        rows: [{ amount: "2", status: reservationStatus }],
        rowCount: 1,
      };
    }
    if (sql.includes("FROM ecc_provider_executions")) {
      return {
        rows: [{ status: executionStatus }],
        rowCount: 1,
      };
    }
    if (sql.includes("UPDATE ecc_usage_counters")) {
      return { rows: [], rowCount: counterRows };
    }
    if (sql.includes("UPDATE ecc_usage_reservations")) {
      return { rows: [], rowCount: reservationUpdateRows };
    }
    if (sql.includes("UPDATE ecc_provider_executions")) {
      return { rows: [], rowCount: executionUpdateRows };
    }
    throw new Error("unexpected_sql");
  });

  transaction.mockImplementation(async work =>
    work({ query: db } as never)
  );
});

describe("V16.8F atomic provider settlement", () => {
  it("commits confirmed success and its usage together", async () => {
    expect(await settleProviderExecution(base)).toEqual({
      applied: true,
      status: "succeeded",
    });

    const queries = db.mock.calls.map(([sql]) => String(sql));

    expect(queries[0]).toContain("FOR UPDATE");
    expect(queries[1]).toContain("FOR UPDATE");
    expect(queries[2]).toContain("reserved >= $5");
    expect(queries[2]).toContain("committed = committed + $5");
    expect(queries[3]).toContain("UPDATE ecc_usage_reservations");
    expect(queries[4]).toContain("UPDATE ecc_provider_executions");
    expect(db.mock.calls[2][1][4]).toBe(2);
  });

  it("releases quota only for confirmed failure", async () => {
    expect(await settleProviderExecution({
      ...base,
      outcome: "failed",
      resultHash: null,
    })).toEqual({ applied: true, status: "failed" });

    const sql = String(db.mock.calls[2][0]);
    expect(sql).toContain("reserved = reserved - $5");
    expect(sql).not.toContain("committed = committed + $5");
  });

  it("preserves reserved quota for uncertain outcomes", async () => {
    expect(await settleProviderExecution({
      ...base,
      outcome: "reconciliation_required",
      resultHash: null,
    })).toEqual({
      applied: true,
      status: "reconciliation_required",
    });

    expect(db.mock.calls).toHaveLength(3);
    expect(String(db.mock.calls[2][0]))
      .toContain("UPDATE ecc_provider_executions");
  });

  it("does not settle a previously finalized execution", async () => {
    executionStatus = "succeeded";

    expect(await settleProviderExecution(base)).toEqual({
      applied: false,
      status: "succeeded",
    });

    expect(db.mock.calls).toHaveLength(2);
  });

  it("rejects an inconsistent reservation state", async () => {
    reservationStatus = "released";

    await expect(settleProviderExecution(base))
      .rejects.toThrow("provider_settlement_reservation_conflict");
  });

  it("stops before changing status if the counter mismatches", async () => {
    counterRows = 0;

    await expect(settleProviderExecution(base))
      .rejects.toThrow("provider_settlement_counter_mismatch");

    expect(db.mock.calls).toHaveLength(3);
  });

  it("propagates reservation update failure", async () => {
    reservationUpdateRows = 0;

    await expect(settleProviderExecution(base))
      .rejects.toThrow(
        "provider_settlement_reservation_update_failed"
      );

    expect(db.mock.calls).toHaveLength(4);
  });

  it("propagates execution update failure", async () => {
    executionUpdateRows = 0;

    await expect(settleProviderExecution(base))
      .rejects.toThrow(
        "provider_settlement_execution_update_failed"
      );
  });

  it("requires evidence hash for confirmed success", async () => {
    await expect(settleProviderExecution({
      ...base,
      resultHash: null,
    })).rejects.toThrow("invalid_provider_settlement");

    expect(transaction).not.toHaveBeenCalled();
  });
});
