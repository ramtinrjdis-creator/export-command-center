import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getPostgresPool } from "../persistence/postgres";
import { PostgresUsageStore } from "../persistence/postgres-commercial";
import { claimProviderExecution } from "../persistence/provider-execution";
import { settleProviderExecution } from "../persistence/provider-settlement";
import { consumeAbuseBudget } from "../persistence/durable-abuse-control";
import { recordReconciliationEvidence } from "../persistence/provider-reconciliation";

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

  it("settles concurrent conflicting outcomes exactly once", async () => {
    const sc = scope("integration-user-a", "ig-concurrent-settlement");

    expect((await reserve(
      sc.userId, sc.periodKey, "ig-race-r", 2,
    )).accepted).toBe(true);

    expect((await claimProviderExecution({
      executionId: "ig-race-e",
      reservationId: "ig-race-r",
      accountId: sc.accountId,
      userId: sc.userId,
      provider: "integration-provider",
      requestHash: "f".repeat(64),
    })).created).toBe(true);

    // These are controlled test outcomes, not real provider responses.
    const [success, failure] = await Promise.all([
      settleProviderExecution({
        scope: sc,
        reservationId: "ig-race-r",
        executionId: "ig-race-e",
        outcome: "succeeded",
        resultHash: "a".repeat(64),
      }),
      settleProviderExecution({
        scope: sc,
        reservationId: "ig-race-r",
        executionId: "ig-race-e",
        outcome: "failed",
      }),
    ]);

    expect([success.applied, failure.applied].sort())
      .toEqual([false, true]);

    const state = await db.query(`
      SELECT r.status AS reservation,
             e.status AS execution,
             c.committed::int AS committed,
             c.reserved::int AS reserved
      FROM ecc_usage_reservations r
      JOIN ecc_provider_executions e
        ON e.reservation_id = r.reservation_id
      JOIN ecc_usage_counters c
        ON c.account_id = r.account_id
       AND c.user_id = r.user_id
       AND c.capability = r.capability
       AND c.period_key = r.period_key
      WHERE r.reservation_id = 'ig-race-r'
    `);

    expect(state.rows).toHaveLength(1);

    if (success.applied) {
      expect(state.rows[0]).toEqual({
        reservation: "committed",
        execution: "succeeded",
        committed: 2,
        reserved: 0,
      });
    } else {
      expect(state.rows[0]).toEqual({
        reservation: "released",
        execution: "failed",
        committed: 0,
        reserved: 0,
      });
    }
  });

  it("rolls back all changes when the final execution UPDATE fails", async () => {
    const sc = scope("integration-user-b", "ig-final-update-rollback");

    expect((await reserve(
      sc.userId, sc.periodKey, "ig-final-r", 2,
    )).accepted).toBe(true);

    expect((await claimProviderExecution({
      executionId: "ig-final-e",
      reservationId: "ig-final-r",
      accountId: sc.accountId,
      userId: sc.userId,
      provider: "integration-provider",
      requestHash: "b".repeat(64),
    })).created).toBe(true);

    // Disposable PostgreSQL only: inject failure at the LAST write.
    await db.query(`
      CREATE FUNCTION ecc_integration_reject_final()
      RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        IF NEW.execution_id = 'ig-final-e' THEN
          RAISE EXCEPTION 'integration_final_update_failure';
        END IF;
        RETURN NEW;
      END;
      $fn$;
    `);

    await db.query(`
      CREATE TRIGGER ecc_integration_final_failure
      BEFORE UPDATE ON ecc_provider_executions
      FOR EACH ROW
      EXECUTE FUNCTION ecc_integration_reject_final()
    `);

    try {
      await expect(settleProviderExecution({
        scope: sc,
        reservationId: "ig-final-r",
        executionId: "ig-final-e",
        outcome: "succeeded",
        resultHash: "c".repeat(64),
      })).rejects.toThrow("integration_final_update_failure");

      const state = await db.query(`
        SELECT r.status AS reservation,
               e.status AS execution,
               c.committed::int AS committed,
               c.reserved::int AS reserved
        FROM ecc_usage_reservations r
        JOIN ecc_provider_executions e
          ON e.reservation_id = r.reservation_id
        JOIN ecc_usage_counters c
          ON c.account_id = r.account_id
         AND c.user_id = r.user_id
         AND c.capability = r.capability
         AND c.period_key = r.period_key
        WHERE r.reservation_id = 'ig-final-r'
      `);

      expect(state.rows).toEqual([{
        reservation: "reserved",
        execution: "pending",
        committed: 0,
        reserved: 2,
      }]);
    } finally {
      await db.query(
        "DROP TRIGGER IF EXISTS ecc_integration_final_failure ON ecc_provider_executions"
      );
      await db.query(
        "DROP FUNCTION IF EXISTS ecc_integration_reject_final()"
      );
    }
  });


  it("blocks independent commit and release once provider execution exists", async () => {
    const sc = scope("integration-user-a", "ig-legacy-guard");

    expect((await reserve(
      sc.userId, sc.periodKey, "ig-legacy-r", 2,
    )).accepted).toBe(true);

    expect((await claimProviderExecution({
      executionId: "ig-legacy-e",
      reservationId: "ig-legacy-r",
      accountId: sc.accountId,
      userId: sc.userId,
      provider: "integration-provider",
      requestHash: "a".repeat(64),
    })).created).toBe(true);

    for (const method of ["commit", "release"] as const) {
      await expect(store[method]({
        scope: sc, reservationId: "ig-legacy-r", amount: 2,
      })).rejects.toThrow(
        "provider_execution_requires_atomic_settlement"
      );
    }

    const state = await db.query(`
      SELECT r.status AS reservation,
             e.status AS execution,
             c.committed::int AS committed,
             c.reserved::int AS reserved
      FROM ecc_usage_reservations r
      JOIN ecc_provider_executions e ON e.reservation_id = r.reservation_id
      JOIN ecc_usage_counters c
        ON c.account_id = r.account_id AND c.user_id = r.user_id
       AND c.capability = r.capability AND c.period_key = r.period_key
      WHERE r.reservation_id = 'ig-legacy-r'
    `);

    expect(state.rows).toEqual([{
      reservation: "reserved",
      execution: "pending",
      committed: 0,
      reserved: 2,
    }]);
  });


  it("enforces append-only reconciliation without changing financial state", async () => {
    const sc = scope("integration-user-a", "ig-reconciliation");

    expect((await reserve(
      sc.userId, sc.periodKey, "ig-audit-r", 2,
    )).accepted).toBe(true);

    expect((await claimProviderExecution({
      executionId: "ig-audit-e",
      reservationId: "ig-audit-r",
      accountId: sc.accountId,
      userId: sc.userId,
      provider: "integration-provider",
      requestHash: "a".repeat(64),
    })).created).toBe(true);

    expect((await settleProviderExecution({
      scope: sc,
      reservationId: "ig-audit-r",
      executionId: "ig-audit-e",
      outcome: "reconciliation_required",
    })).applied).toBe(true);

    const evidence = {
      eventId: "ig-audit-event",
      executionId: "ig-audit-e",
      accountId: sc.accountId,
      actorId: "integration-reviewer",
      evidenceHash: "b".repeat(64),
      eventType: "evidence_received" as const,
    };

    expect(await recordReconciliationEvidence(evidence))
      .toEqual({ created: true });

    expect(await recordReconciliationEvidence(evidence))
      .toEqual({ created: false });

    await expect(recordReconciliationEvidence({
      ...evidence,
      evidenceHash: "c".repeat(64),
    })).rejects.toThrow("reconciliation_event_identity_conflict");

    const count = await db.query(`
      SELECT count(*)::int AS total
      FROM ecc_provider_reconciliation_events
      WHERE execution_id = 'ig-audit-e'
    `);

    expect(count.rows[0].total).toBe(1);

    await expect(db.query(`
      UPDATE ecc_provider_reconciliation_events
      SET evidence_hash = $1
      WHERE event_id = $2
    `, ["d".repeat(64), evidence.eventId]))
      .rejects.toThrow("reconciliation_audit_immutable");

    await expect(db.query(`
      DELETE FROM ecc_provider_reconciliation_events
      WHERE event_id = $1
    `, [evidence.eventId]))
      .rejects.toThrow("reconciliation_audit_immutable");

    const state = await db.query(`
      SELECT r.status AS reservation,
             e.status AS execution,
             c.committed::int AS committed,
             c.reserved::int AS reserved
      FROM ecc_usage_reservations r
      JOIN ecc_provider_executions e
        ON e.reservation_id = r.reservation_id
      JOIN ecc_usage_counters c
        ON c.account_id = r.account_id
       AND c.user_id = r.user_id
       AND c.capability = r.capability
       AND c.period_key = r.period_key
      WHERE r.reservation_id = 'ig-audit-r'
    `);

    expect(state.rows).toEqual([{
      reservation: "reserved",
      execution: "reconciliation_required",
      committed: 0,
      reserved: 2,
    }]);
  });


  it("enforces durable abuse budget across 20 concurrent requests", async () => {
    const policy = {
      accountId: "integration-account",
      userId: "integration-user-a",
      capability: "ig-abuse-concurrent",
      limit: 3,
      windowMs: 60000,
    };

    const results = await Promise.all(
      Array.from({ length: 20 }, () => consumeAbuseBudget(policy)),
    );

    const accepted = results.filter(result => result.allowed);
    const denied = results.filter(result => !result.allowed);

    expect(accepted).toHaveLength(3);
    expect(denied).toHaveLength(17);

    expect(
      accepted.map(result => result.used).sort((a, b) =>
        Number(a) - Number(b)
      ),
    ).toEqual([1, 2, 3]);

    const scopeKey = JSON.stringify([
      "ecc-abuse-v16",
      policy.accountId,
      policy.userId,
      policy.capability,
      policy.windowMs,
    ]);

    const stored = await db.query(
      `
      SELECT count::int AS used
      FROM ecc_abuse_counters
      WHERE scope_key = $1
      `,
      [scopeKey],
    );

    expect(stored.rows).toEqual([{ used: 3 }]);

    // Another request in the same window cannot consume more budget.
    const additional = await consumeAbuseBudget(policy);

    expect(additional.allowed).toBe(false);

    const after = await db.query(
      `
      SELECT count::int AS used
      FROM ecc_abuse_counters
      WHERE scope_key = $1
      `,
      [scopeKey],
    );

    expect(after.rows).toEqual([{ used: 3 }]);

    // A different verified member has a distinct accounting scope.
    const otherMember = await consumeAbuseBudget({
      ...policy,
      userId: "integration-user-b",
    });

    expect(otherMember).toMatchObject({
      allowed: true,
      used: 1,
    });
  });

});
