import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../persistence/postgres", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

import { withTransaction } from "../persistence/postgres";
import { PostgresUsageStore } from "../persistence/postgres-commercial";

const tx = vi.mocked(withTransaction);
const clientQuery = vi.fn();
const observedSql: string[] = [];

let aggregateOverride:
  | { committed: string; reserved: string }
  | null = null;

let lockedCounter:
  | { committed: string; reserved: string }
  | null = null;

const store = new PostgresUsageStore();

const base = {
  scope: {
    accountId: "account-1",
    userId: "user-1",
    capability: "buyer_intelligence",
    periodKey: "2026-10",
  },
  reservationId: "reservation-1",
  amount: 1,
  reservedAt: 1000,
  expiresAt: 1200,
  authorizedPlan: "pro_monthly" as const,
};

function queueSuccessfulReservation(
  committed: number,
  reserved: number,
  inserted = true,
) {
  clientQuery
    .mockResolvedValueOnce({ rows: [{}] }) // membership
    .mockResolvedValueOnce({ rows: [] }) // ensure counter
    .mockResolvedValueOnce({
      rows: [{
        committed: String(committed),
        reserved: String(reserved),
      }],
    }) // locked counter
    .mockResolvedValueOnce({
      rows: inserted
        ? [{ reservation_id: "reservation-1" }]
        : [],
    }) // reservation insert
    .mockResolvedValueOnce({ rows: [] }); // update counter
}

describe("V16.8B atomic buyer quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear queued mockResolvedValueOnce responses between tests.
    clientQuery.mockReset();
    observedSql.length = 0;
    aggregateOverride = null;
    lockedCounter = null;

    tx.mockImplementation(async (work) =>
      work({
        query: async (...args: unknown[]) => {
          const sql = String(args[0]);
          observedSql.push(sql);

          if (sql.includes("pg_advisory_xact_lock")) {
            return { rows: [{}] };
          }

          if (sql.includes("SUM(committed)")) {
            return {
              rows: [aggregateOverride ?? lockedCounter ?? {
                committed: "0",
                reserved: "0",
              }],
            };
          }

          const result = await clientQuery(...args);

          if (sql.includes("FOR UPDATE")) {
            lockedCounter = result.rows[0] ?? null;
          }

          return result;
        },
      } as never)
    );
  });

  it("rejects Free plans before opening a transaction", async () => {
    const result = await store.reserve({
      ...base,
      authorizedPlan: "free",
    });

    expect(result.accepted).toBe(false);
    expect(tx).not.toHaveBeenCalled();
  });

  it("rejects unsupported capabilities", async () => {
    const result = await store.reserve({
      ...base,
      scope: { ...base.scope, capability: "market_scan" },
    });

    expect(result.accepted).toBe(false);
    expect(tx).not.toHaveBeenCalled();
  });

  it("rejects non-integer amounts", async () => {
    const result = await store.reserve({
      ...base,
      amount: 1.5,
    });

    expect(result.accepted).toBe(false);
    expect(tx).not.toHaveBeenCalled();
  });

  it("reserves when remaining quota is available", async () => {
    queueSuccessfulReservation(20, 9);

    const result = await store.reserve(base);

    expect(result).toMatchObject({
      accepted: true,
      committed: 20,
      reserved: 10,
    });

    const sql = clientQuery.mock.calls
      .map(call => String(call[0]));

    expect(sql.some(q => q.includes("FOR UPDATE"))).toBe(true);
    expect(sql.some(q => q.includes("ON CONFLICT (reservation_id)"))).toBe(true);
  });

  it("rejects a reservation at the monthly limit", async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [{}] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ committed: "29", reserved: "1" }],
      });

    const result = await store.reserve(base);

    expect(result).toMatchObject({
      accepted: false,
      committed: 29,
      reserved: 1,
    });

    expect(clientQuery).toHaveBeenCalledTimes(3);
  });

  it("does not double-count duplicate reservation IDs", async () => {
    queueSuccessfulReservation(4, 2, false);

    const result = await store.reserve(base);

    expect(result).toMatchObject({
      accepted: false,
      committed: 4,
      reserved: 2,
    });

    expect(clientQuery).toHaveBeenCalledTimes(4);
  });

  it("enforces quota across two different account members", async () => {
    queueSuccessfulReservation(2, 0);

    aggregateOverride = {
      committed: "29",
      reserved: "1",
    };

    const result = await store.reserve(base);

    expect(result.accepted).toBe(false);
    expect(clientQuery).toHaveBeenCalledTimes(3);
    expect(observedSql.some(q =>
      q.includes("SUM(committed)") &&
      q.includes("SUM(reserved)")
    )).toBe(true);
  });

  it("takes the account-period lock before creating a user counter", async () => {
    queueSuccessfulReservation(1, 0);

    const result = await store.reserve(base);

    expect(result.accepted).toBe(true);

    const lockIndex = observedSql.findIndex(q =>
      q.includes("pg_advisory_xact_lock")
    );

    const insertIndex = observedSql.findIndex(q =>
      q.includes("INSERT INTO ecc_usage_counters")
    );

    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(lockIndex);
  });

  it("fails closed if the database transaction fails", async () => {
    tx.mockRejectedValueOnce(new Error("database_unavailable"));

    await expect(store.reserve(base))
      .rejects.toThrow("database_unavailable");
  });
});
