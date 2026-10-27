import "server-only";

import { withTransaction } from "./postgres";

const SAFE_ID = /^[A-Za-z0-9._:-]{1,160}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export type ReconciliationEvidenceInput = {
  eventId: string;
  executionId: string;
  accountId: string;

  /**
   * Must come from a previously authenticated, server-side actor.
   * This persistence primitive does not authenticate callers.
   */
  actorId: string;

  evidenceHash: string;
  eventType: "evidence_received" | "review_note";
};

type EventRow = {
  event_id: string;
  execution_id: string;
  account_id: string;
  actor_id: string;
  evidence_hash: string;
  event_type: string;
};

/**
 * Records audit evidence only.
 *
 * No provider dispatch.
 * No subscription changes.
 * No usage commit/release.
 * No resolution of an uncertain execution.
 */
export async function recordReconciliationEvidence(
  input: ReconciliationEvidenceInput,
): Promise<{ created: boolean }> {
  if (
    ![
      input.eventId,
      input.executionId,
      input.accountId,
      input.actorId,
    ].every(value => SAFE_ID.test(value)) ||
    !SHA256.test(input.evidenceHash) ||
    !["evidence_received", "review_note"].includes(input.eventType)
  ) {
    throw new Error("invalid_reconciliation_evidence");
  }

  return withTransaction(async client => {
    const execution = await client.query<{
      status: string;
    }>(
      `
      SELECT status
      FROM ecc_provider_executions
      WHERE execution_id = $1
        AND account_id = $2
      FOR UPDATE
      `,
      [input.executionId, input.accountId],
    );

    if (execution.rows.length !== 1) {
      throw new Error("reconciliation_execution_not_found");
    }

    /*
     * Existing audit events remain readable after finalization,
     * but new uncertain-outcome evidence is accepted only while
     * the operation is explicitly marked for reconciliation.
     */
    if (execution.rows[0].status !== "reconciliation_required") {
      throw new Error("reconciliation_execution_not_eligible");
    }

    const inserted = await client.query(
      `
      INSERT INTO ecc_provider_reconciliation_events (
        event_id,
        execution_id,
        account_id,
        actor_id,
        evidence_hash,
        event_type
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id
      `,
      [
        input.eventId,
        input.executionId,
        input.accountId,
        input.actorId,
        input.evidenceHash,
        input.eventType,
      ],
    );

    if (inserted.rowCount === 1) {
      return { created: true };
    }

    const existing = await client.query<EventRow>(
      `
      SELECT
        event_id,
        execution_id,
        account_id,
        actor_id,
        evidence_hash,
        event_type
      FROM ecc_provider_reconciliation_events
      WHERE event_id = $1
      `,
      [input.eventId],
    );

    const row = existing.rows[0];

    if (
      existing.rows.length !== 1 ||
      row.execution_id !== input.executionId ||
      row.account_id !== input.accountId ||
      row.actor_id !== input.actorId ||
      row.evidence_hash !== input.evidenceHash ||
      row.event_type !== input.eventType
    ) {
      throw new Error("reconciliation_event_identity_conflict");
    }

    return { created: false };
  });
}
