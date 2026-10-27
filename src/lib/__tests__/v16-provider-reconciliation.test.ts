import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../persistence/postgres", () => ({
  withTransaction: vi.fn(),
}));

import { withTransaction } from "../persistence/postgres";
import {
  recordReconciliationEvidence,
} from "../persistence/provider-reconciliation";

const transaction = vi.mocked(withTransaction);
const db = vi.fn();

const input = {
  eventId: "audit-1",
  executionId: "execution-1",
  accountId: "account-1",
  actorId: "reviewer-1",
  evidenceHash: "a".repeat(64),
  eventType: "evidence_received" as const,
};

let status = "reconciliation_required";
let inserted = 1;
let existing = {
  event_id: input.eventId,
  execution_id: input.executionId,
  account_id: input.accountId,
  actor_id: input.actorId,
  evidence_hash: input.evidenceHash,
  event_type: input.eventType,
};

beforeEach(() => {
  vi.resetAllMocks();

  status = "reconciliation_required";
  inserted = 1;
  existing = {
    event_id: input.eventId,
    execution_id: input.executionId,
    account_id: input.accountId,
    actor_id: input.actorId,
    evidence_hash: input.evidenceHash,
    event_type: input.eventType,
  };

  db.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM ecc_provider_executions")) {
      return {
        rows: [{ status }],
        rowCount: 1,
      };
    }

    if (sql.includes("INSERT INTO ecc_provider_reconciliation_events")) {
      return {
        rows: inserted ? [{ event_id: input.eventId }] : [],
        rowCount: inserted,
      };
    }

    if (sql.includes("FROM ecc_provider_reconciliation_events")) {
      return {
        rows: [existing],
        rowCount: 1,
      };
    }

    throw new Error("unexpected_sql");
  });

  transaction.mockImplementation(async work =>
    work({ query: db } as never)
  );
});

describe("V16.8H-B reconciliation evidence", () => {
  it("records evidence only for an uncertain execution", async () => {
    expect(await recordReconciliationEvidence(input))
      .toEqual({ created: true });

    const queries = db.mock.calls.map(([sql]) => String(sql));

    expect(queries[0]).toContain("FOR UPDATE");
    expect(queries[1]).toContain("ON CONFLICT (event_id) DO NOTHING");
    expect(queries.some(sql =>
      sql.includes("UPDATE ecc_usage_counters")
    )).toBe(false);
  });

  it("does not insert for a non-eligible execution", async () => {
    status = "succeeded";

    await expect(recordReconciliationEvidence(input))
      .rejects.toThrow("reconciliation_execution_not_eligible");

    expect(db).toHaveBeenCalledTimes(1);
  });

  it("treats an identical duplicate as idempotent", async () => {
    inserted = 0;

    expect(await recordReconciliationEvidence(input))
      .toEqual({ created: false });
  });

  it("rejects an event ID reused with different evidence", async () => {
    inserted = 0;
    existing = {
      ...existing,
      evidence_hash: "b".repeat(64),
    };

    await expect(recordReconciliationEvidence(input))
      .rejects.toThrow("reconciliation_event_identity_conflict");
  });

  it("rejects invalid evidence hashes before a transaction", async () => {
    await expect(recordReconciliationEvidence({
      ...input,
      evidenceHash: "invalid",
    })).rejects.toThrow("invalid_reconciliation_evidence");

    expect(transaction).not.toHaveBeenCalled();
  });

  it("fails closed when persistence fails", async () => {
    transaction.mockRejectedValueOnce(
      new Error("database_unavailable")
    );

    await expect(recordReconciliationEvidence(input))
      .rejects.toThrow("database_unavailable");
  });
});
