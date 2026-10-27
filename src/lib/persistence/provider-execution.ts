import "server-only";

import { query } from "./postgres";

export type ExecutionStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "reconciliation_required";

type ExecutionRow = {
  execution_id: string;
  reservation_id: string;
  account_id: string;
  user_id: string;
  provider: string;
  request_hash: string;
  status: ExecutionStatus;
};

export type ExecutionClaim = {
  executionId: string;
  reservationId: string;
  accountId: string;
  userId: string;
  provider: string;
  requestHash: string;
};

const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function validClaim(input: ExecutionClaim): boolean {
  return (
    SAFE_ID.test(input.executionId) &&
    SAFE_ID.test(input.reservationId) &&
    SAFE_ID.test(input.accountId) &&
    SAFE_ID.test(input.userId) &&
    SAFE_ID.test(input.provider) &&
    SHA256.test(input.requestHash)
  );
}

/**
 * Returns created=true only for the first successful INSERT.
 *
 * The caller must NOT dispatch the provider if created=false.
 * Even an existing 'pending' record is not permission to retry.
 *
 * The reservation must already exist and belong to the supplied
 * authenticated account/user. SQL verifies this relationship.
 *
 * Caller must not dispatch on a database error.
 */
export async function claimProviderExecution(
  input: ExecutionClaim,
): Promise<{
  created: boolean;
  status: ExecutionStatus | null;
}> {
  if (!validClaim(input)) {
    throw new Error("invalid_provider_execution_claim");
  }

  const inserted = await query<{
    status: ExecutionStatus;
  }>(
    `
    INSERT INTO ecc_provider_executions (
      execution_id,
      reservation_id,
      account_id,
      user_id,
      provider,
      request_hash,
      status
    )
    SELECT
      $1, r.reservation_id, r.account_id, r.user_id,
      $5, $6, 'pending'
    FROM ecc_usage_reservations AS r
    WHERE r.reservation_id = $2
      AND r.account_id = $3
      AND r.user_id = $4
      AND r.status = 'reserved'
    ON CONFLICT DO NOTHING
    RETURNING status
    `,
    [
      input.executionId,
      input.reservationId,
      input.accountId,
      input.userId,
      input.provider,
      input.requestHash,
    ],
  );

  if (inserted.rows.length === 1) {
    return { created: true, status: "pending" };
  }

  /*
   * Existing operations never grant dispatch permission,
   * including when the stored status is still pending.
   */
  const existing = await query<ExecutionRow>(
    `
    SELECT
      execution_id, reservation_id, account_id, user_id,
      provider, request_hash, status
    FROM ecc_provider_executions
    WHERE execution_id = $1 OR reservation_id = $2
    LIMIT 2
    `,
    [input.executionId, input.reservationId],
  );

  if (existing.rows.length === 0) {
    return { created: false, status: null };
  }

  const matching = existing.rows.length === 1 &&
    existing.rows[0].execution_id === input.executionId &&
    existing.rows[0].reservation_id === input.reservationId &&
    existing.rows[0].account_id === input.accountId &&
    existing.rows[0].user_id === input.userId &&
    existing.rows[0].provider === input.provider &&
    existing.rows[0].request_hash === input.requestHash;

  if (!matching) {
    throw new Error("provider_execution_identity_conflict");
  }

  return {
    created: false,
    status: existing.rows[0].status,
  };
}

/**
 * Compare-and-set transition. Only pending can be finalized.
 * Repeated calls cannot overwrite an already finalized outcome.
 *
 * A pending execution may be dispatched or not yet dispatched;
 * never infer it is safe to retry based on its age.
 */
export async function transitionProviderExecution(input: {
  executionId: string;
  nextStatus: Exclude<ExecutionStatus, "pending">;
  providerRequestId?: string | null;
  resultHash?: string | null;
}): Promise<boolean> {
  if (
    !SAFE_ID.test(input.executionId) ||
    ![
      "succeeded",
      "failed",
      "reconciliation_required",
    ].includes(input.nextStatus) ||
    (input.providerRequestId != null &&
      !SAFE_ID.test(input.providerRequestId)) ||
    (input.resultHash != null &&
      !SHA256.test(input.resultHash))
  ) {
    throw new Error("invalid_provider_execution_transition");
  }

  const updated = await query(
    `
    UPDATE ecc_provider_executions
    SET status = $2,
        provider_request_id = $3,
        result_hash = $4,
        updated_at = NOW()
    WHERE execution_id = $1
      AND status = 'pending'
    `,
    [
      input.executionId,
      input.nextStatus,
      input.providerRequestId ?? null,
      input.resultHash ?? null,
    ],
  );

  return updated.rowCount === 1;
}
