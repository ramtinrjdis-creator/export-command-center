import "server-only";

import { withTransaction } from "./postgres";

type Scope = {
  accountId: string;
  userId: string;
  capability: string;
  periodKey: string;
};

type Outcome =
  | "succeeded"
  | "failed"
  | "reconciliation_required";

type SettlementInput = {
  scope: Scope;
  reservationId: string;
  executionId: string;
  outcome: Outcome;
  providerRequestId?: string | null;
  resultHash?: string | null;
};

const ID = /^[A-Za-z0-9._:-]{1,160}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/**
 * Server-side persistence primitive.
 *
 * The caller must provide a VERIFIED provider outcome.
 * A network timeout is reconciliation_required, never failed.
 *
 * Lock order: reservation -> execution -> usage counter.
 * All mutations commit together or roll back together.
 */
export async function settleProviderExecution(
  input: SettlementInput,
): Promise<{ applied: boolean; status: Outcome | null }> {
  const { scope } = input;

  if (
    ![
      scope.accountId,
      scope.userId,
      scope.capability,
      scope.periodKey,
      input.reservationId,
      input.executionId,
    ].every(value => ID.test(value)) ||
    ![
      "succeeded",
      "failed",
      "reconciliation_required",
    ].includes(input.outcome) ||
    (input.providerRequestId != null &&
      !ID.test(input.providerRequestId)) ||
    (input.resultHash != null &&
      !SHA256.test(input.resultHash)) ||
    (input.outcome === "succeeded" && !input.resultHash)
  ) {
    throw new Error("invalid_provider_settlement");
  }

  return withTransaction(async client => {
    const reservation = await client.query<{
      amount: string;
      status: string;
    }>(
      `
      SELECT amount, status
      FROM ecc_usage_reservations
      WHERE reservation_id = $1
        AND account_id = $2
        AND user_id = $3
        AND capability = $4
        AND period_key = $5
      FOR UPDATE
      `,
      [
        input.reservationId,
        scope.accountId,
        scope.userId,
        scope.capability,
        scope.periodKey,
      ],
    );

    if (reservation.rows.length !== 1) {
      throw new Error("provider_settlement_reservation_not_found");
    }

    const execution = await client.query<{
      status: string;
    }>(
      `
      SELECT status
      FROM ecc_provider_executions
      WHERE execution_id = $1
        AND reservation_id = $2
        AND account_id = $3
        AND user_id = $4
      FOR UPDATE
      `,
      [
        input.executionId,
        input.reservationId,
        scope.accountId,
        scope.userId,
      ],
    );

    if (execution.rows.length !== 1) {
      throw new Error("provider_settlement_execution_not_found");
    }

    const reservationRow = reservation.rows[0];
    const executionRow = execution.rows[0];

    // A finalized or uncertain operation is never automatically
    // redispatched, re-settled, or released.
    if (executionRow.status !== "pending") {
      return {
        applied: false,
        status: executionRow.status as Outcome,
      };
    }

    if (reservationRow.status !== "reserved") {
      throw new Error("provider_settlement_reservation_conflict");
    }

    const amount = Number(reservationRow.amount);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("invalid_usage_reservation_amount");
    }

    if (input.outcome !== "reconciliation_required") {
      const success = input.outcome === "succeeded";

      const counter = await client.query(
        success
          ? `
            UPDATE ecc_usage_counters
            SET committed = committed + $5,
                reserved = reserved - $5,
                updated_at = NOW()
            WHERE account_id = $1
              AND user_id = $2
              AND capability = $3
              AND period_key = $4
              AND reserved >= $5
          `
          : `
            UPDATE ecc_usage_counters
            SET reserved = reserved - $5,
                updated_at = NOW()
            WHERE account_id = $1
              AND user_id = $2
              AND capability = $3
              AND period_key = $4
              AND reserved >= $5
          `,
        [
          scope.accountId,
          scope.userId,
          scope.capability,
          scope.periodKey,
          amount,
        ],
      );

      if (counter.rowCount !== 1) {
        throw new Error("provider_settlement_counter_mismatch");
      }

      const reservationUpdate = await client.query(
        `
        UPDATE ecc_usage_reservations
        SET status = $2
        WHERE reservation_id = $1
          AND status = 'reserved'
        `,
        [
          input.reservationId,
          success ? "committed" : "released",
        ],
      );

      if (reservationUpdate.rowCount !== 1) {
        throw new Error("provider_settlement_reservation_update_failed");
      }
    }

    const executionUpdate = await client.query(
      `
      UPDATE ecc_provider_executions
      SET status = $2,
          provider_request_id = $3,
          result_hash = $4,
          updated_at = NOW()
      WHERE execution_id = $1
        AND reservation_id = $5
        AND status = 'pending'
      `,
      [
        input.executionId,
        input.outcome,
        input.providerRequestId ?? null,
        input.resultHash ?? null,
        input.reservationId,
      ],
    );

    if (executionUpdate.rowCount !== 1) {
      throw new Error("provider_settlement_execution_update_failed");
    }

    return { applied: true, status: input.outcome };
  });
}
