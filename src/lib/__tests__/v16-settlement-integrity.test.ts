import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../persistence/postgres", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

import { withTransaction } from "../persistence/postgres";
import { PostgresUsageStore } from "../persistence/postgres-commercial";

const transaction = vi.mocked(withTransaction);
const clientQuery = vi.fn();
const store = new PostgresUsageStore();

const scope = {
  accountId: "account-1",
  userId: "user-1",
  capability: "buyer_intelligence",
  periodKey: "period-1",
};

const input = {
  scope,
  reservationId: "res-1",
  amount: 1,
};

let reservationAmount = "1";
let reservationStatus = "reserved";
let counterRowCount = 1;

beforeEach(() => {
  vi.clearAllMocks();
  clientQuery.mockReset();

  reservationAmount = "1";
  reservationStatus = "reserved";
  counterRowCount = 1;

  clientQuery.mockImplementation(async (sql: string) => {
    if (
      sql.includes("FROM ecc_usage_reservations") &&
      sql.includes("FOR UPDATE")
    ) {
      return {
        rows: [{
          amount: reservationAmount,
          status: reservationStatus,
        }],
        rowCount: 1,
      };
    }

    if (sql.includes("FROM ecc_provider_executions")) {
      return { rows: [{ linked: false }], rowCount: 1 };
    }

    if (sql.includes("UPDATE ecc_usage_counters")) {
      return { rows: [], rowCount: counterRowCount };
    }

    if (sql.includes("UPDATE ecc_usage_reservations")) {
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes("FROM ecc_usage_counters")) {
      return {
        rows: [{ committed: "1", reserved: "0" }],
        rowCount: 1,
      };
    }

    throw new Error("unexpected_sql");
  });

  transaction.mockImplementation(async work =>
    work({ query: clientQuery } as never)
  );
});

describe("V16.8D settlement integrity", () => {
  it("blocks legacy settlement for a linked execution", async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM ecc_usage_reservations")) {
        return { rows: [{ amount: "1", status: "reserved" }], rowCount: 1 };
      }
      if (sql.includes("FROM ecc_provider_executions")) {
        return { rows: [{ linked: true }], rowCount: 1 };
      }
      throw new Error("unexpected_sql");
    });

    await expect(store.commit(input)).rejects.toThrow(
      "provider_execution_requires_atomic_settlement"
    );
    await expect(store.release(input)).rejects.toThrow(
      "provider_execution_requires_atomic_settlement"
    );
    expect(clientQuery.mock.calls.some(([sql]) =>
      String(sql).includes("UPDATE ecc_usage_counters")
    )).toBe(false);
  });

  it("commits an existing reservation", async () => {
    const result = await store.commit(input);
    expect(result.committed).toBe(true);
  });

  it("rejects duplicate commits", async () => {
    reservationStatus = "committed";
    const result = await store.commit(input);

    expect(result.committed).toBe(false);
    expect(clientQuery.mock.calls.some(
      ([sql]) => String(sql).includes("UPDATE ecc_usage_counters")
    )).toBe(false);
  });

  it("rejects invalid reservation amounts", async () => {
    reservationAmount = "0";

    await expect(store.commit(input))
      .rejects.toThrow("invalid_usage_reservation_amount");
  });

  it("rejects commit if the counter row is missing", async () => {
    counterRowCount = 0;

    await expect(store.commit(input))
      .rejects.toThrow("usage_counter_update_failed");

    expect(clientQuery.mock.calls.some(
      ([sql]) => String(sql).includes("SET status = 'committed'")
    )).toBe(false);
  });

  it("releases the complete stored reservation amount", async () => {
    reservationAmount = "3";
    const result = await store.release(input);

    expect(result.released).toBe(true);

    const update = clientQuery.mock.calls.find(
      ([sql]) => String(sql).includes("UPDATE ecc_usage_counters")
    );

    expect(update?.[1]).toEqual([
      "account-1",
      "user-1",
      "buyer_intelligence",
      "period-1",
      3,
    ]);
  });

  it("rejects duplicate releases", async () => {
    reservationStatus = "released";

    expect((await store.release(input)).released).toBe(false);
  });

  it("rejects release if the counter row is missing", async () => {
    counterRowCount = 0;

    await expect(store.release(input))
      .rejects.toThrow("usage_counter_update_failed");

    expect(clientQuery.mock.calls.some(
      ([sql]) => String(sql).includes("SET status = 'released'")
    )).toBe(false);
  });

  it("propagates transaction failures", async () => {
    transaction.mockRejectedValueOnce(new Error("db_unavailable"));

    await expect(store.commit(input))
      .rejects.toThrow("db_unavailable");
  });
});
