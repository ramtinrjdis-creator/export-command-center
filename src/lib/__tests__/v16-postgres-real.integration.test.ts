import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getPostgresPool } from "../persistence/postgres";
import { PostgresUsageStore } from "../persistence/postgres-commercial";
import { claimProviderExecution } from "../persistence/provider-execution";
import { settleProviderExecution } from "../persistence/provider-settlement";

const url = process.env.ECC_TEST_DATABASE_URL;
const enabled = Boolean(url);

const scope = (userId: string, periodKey: string) => ({
  accountId: "integration-account",
  userId,
  capability: "buyer_intelligence",
  periodKey,
});

const store = new PostgresUsageStore();

function reserve(
  userId: string,
  periodKey: string,
  reservationId: string,
  amount: number,
) {
  const reservedAt = Math.floor(Date.now() / 1000);

  return store.reserve({
    scope: scope(userId, periodKey),
    reservationId,
    amount,
    authorizedPlan: "pro_monthly",
    reservedAt,
    expiresAt: reservedAt + 3600,
  });
}

describe.skipIf(!enabled)("V16.8G real PostgreSQL integration", () => {
  let db!: ReturnType<typeof getPostgresPool>;

  beforeAll(async () => {
    if (!url) throw new Error("test_database_missing");

    const parsed = new URL(url);

    if (
      parsed.hostname !== "127.0.0.1" ||
      parsed.pathname !== "/ecc_integration_test" ||
      process.env.ECC_DB_SSL !== "false" ||
      process.env.NODE_ENV === "production"
    ) {
      throw new Error("unsafe_integration_database_target");
    }

    db = getPostgresPool();

    await db.query(
      "INSERT INTO ecc_accounts(id) VALUES($1)",
      ["integration-account"],
    );

    for (const user of ["integration-user-a", "integration-user-b"]) {
      await db.query(
        "INSERT INTO ecc_users(id, external_subject) VALUES($1,$2)",
        [user, `subject-${user}`],
      );
      await db.query(
        "INSERT INTO ecc_account_members(account_id,user_id) VALUES($1,$2)",
        ["integration-account", user],
      );
    }
  });

  afterAll(async () => {
    if (db) await db.end();
  });

  it("enforces one account quota across concurrent users", async () => {
    const [a, b] = await Promise.all([
      reserve("integration-user-a", "ig-concurrent", "ig-r1", 20),
      reserve("integration-user-b", "ig-concurrent", "ig-r2", 20),
    ]);

    expect([a.accepted, b.accepted].sort()).toEqual([false, true]);

    const totals = await db.query(`
      SELECT
        COALESCE(SUM(committed),0)::int AS committed,
        COALESCE(SUM(reserved),0)::int AS reserved
      FROM ecc_usage_counters
      WHERE account_id='integration-account'
        AND period_key='ig-concurrent'
    `);

    expect(totals.rows[0]).toMatchObject({
      committed: 0,
      reserved: 20,
    });

    const reservations = await db.query(`
      SELECT count(*)::int AS count
      FROM ecc_usage_reservations
      WHERE account_id='integration-account'
        AND period_key='ig-concurrent'
    `);

    expect(reservations.rows[0].count).toBe(1);
  });

  it("does not double-reserve the same reservation ID", async () => {
    const [a, b] = await Promise.all([
      reserve("integration-user-a", "ig-duplicate", "ig-duplicate-r", 1),
      reserve("integration-user-a", "ig-duplicate", "ig-duplicate-r", 1),
    ]);

    expect([a.accepted, b.accepted].sort()).toEqual([false, true]);

    const result = await db.query(`
      SELECT reserved::int AS reserved
      FROM ecc_usage_counters
      WHERE account_id='integration-account'
        AND user_id='integration-user-a'
        AND period_key='ig-duplicate'
    `);

    expect(result.rows[0].reserved).toBe(1);
  });

  it("atomically settles success and prevents repeat settlement", async () => {
    const s = scope("integration-user-a", "ig-success");

    expect((await reserve(
      s.userId, s.periodKey, "ig-success-r", 2,
    )).accepted).toBe(true);

    expect(await claimProviderExecution({
      executionId: "ig-success-e",
      reservationId: "ig-success-r",
      accountId: s.accountId,
      userId: s.userId,
      provider: "integration-provider",
      requestHash: "a".repeat(64),
    })).toEqual({ created: true, status: "pending" });

    const input = {
      scope: s,
      reservationId: "ig-success-r",
      executionId: "ig-success-e",
      outcome: "succeeded" as const,
      resultHash: "b".repeat(64),
    };

    expect((await settleProviderExecution(input)).applied).toBe(true);
    expect((await settleProviderExecution(input)).applied).toBe(false);

    const counters = await db.query(`
      SELECT committed::int AS committed, reserved::int AS reserved
      FROM ecc_usage_counters
      WHERE period_key='ig-success'
    `);

    expect(counters.rows[0]).toMatchObject({
      committed: 2,
      reserved: 0,
    });

    const state = await db.query(`
      SELECT r.status AS reservation_status,
             e.status AS execution_status
      FROM ecc_usage_reservations r
      JOIN ecc_provider_executions e
        ON e.reservation_id=r.reservation_id
      WHERE r.reservation_id='ig-success-r'
    `);

    expect(state.rows[0]).toEqual({
      reservation_status: "committed",
      execution_status: "succeeded",
    });
  });

  it("rolls back settlement if its counter is inconsistent", async () => {
    const s = scope("integration-user-b", "ig-rollback");

    expect((await reserve(
      s.userId, s.periodKey, "ig-rollback-r", 2,
    )).accepted).toBe(true);

    expect((await claimProviderExecution({
      executionId: "ig-rollback-e",
      reservationId: "ig-rollback-r",
      accountId: s.accountId,
      userId: s.userId,
      provider: "integration-provider",
      requestHash: "c".repeat(64),
    })).created).toBe(true);

    // Intentional corruption exists only in this disposable test DB.
    await db.query(`
      UPDATE ecc_usage_counters
      SET reserved=0
      WHERE account_id=$1 AND user_id=$2
        AND capability=$3 AND period_key=$4
    `, [
      s.accountId, s.userId, s.capability, s.periodKey,
    ]);

    await expect(settleProviderExecution({
      scope: s,
      reservationId: "ig-rollback-r",
      executionId: "ig-rollback-e",
      outcome: "succeeded",
      resultHash: "d".repeat(64),
    })).rejects.toThrow("provider_settlement_counter_mismatch");

    const state = await db.query(`
      SELECT r.status AS reservation_status,
             e.status AS execution_status
      FROM ecc_usage_reservations r
      JOIN ecc_provider_executions e
        ON e.reservation_id=r.reservation_id
      WHERE r.reservation_id='ig-rollback-r'
    `);

    expect(state.rows[0]).toEqual({
      reservation_status: "reserved",
      execution_status: "pending",
    });
  });

  it("preserves quota for an uncertain provider result", async () => {
    const s = scope("integration-user-a", "ig-uncertain");

    expect((await reserve(
      s.userId, s.periodKey, "ig-uncertain-r", 1,
    )).accepted).toBe(true);

    expect((await claimProviderExecution({
      executionId: "ig-uncertain-e",
      reservationId: "ig-uncertain-r",
      accountId: s.accountId,
      userId: s.userId,
      provider: "integration-provider",
      requestHash: "e".repeat(64),
    })).created).toBe(true);

    expect((await settleProviderExecution({
      scope: s,
      reservationId: "ig-uncertain-r",
      executionId: "ig-uncertain-e",
      outcome: "reconciliation_required",
    })).applied).toBe(true);

    const state = await db.query(`
      SELECT c.reserved::int AS reserved,
             r.status AS reservation_status,
             e.status AS execution_status
      FROM ecc_usage_counters c
      JOIN ecc_usage_reservations r
        ON r.account_id=c.account_id
       AND r.user_id=c.user_id
       AND r.capability=c.capability
       AND r.period_key=c.period_key
      JOIN ecc_provider_executions e
        ON e.reservation_id=r.reservation_id
      WHERE r.reservation_id='ig-uncertain-r'
    `);

    expect(state.rows[0]).toEqual({
      reserved: 1,
      reservation_status: "reserved",
      execution_status: "reconciliation_required",
    });
  });
});
