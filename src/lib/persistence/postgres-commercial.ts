import type {
  ClientBase,
} from "pg";

import {
  getMonthlyEquivalentLimit,
  type CommercialPlan,
} from "../commercial/plan-policy";


import {
  query,
  withTransaction,
} from "./postgres";

import type {
  SubscriptionSnapshot,
} from "../commercial/v15-types";

type SubscriptionRow = {
  subscription_id: string;
  customer_id: string;
  account_id: string;
  state: SubscriptionSnapshot["state"];
  plan_id: string;
  entitlement_ids: string[];
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  source: string;
};

function rowToSubscription(
  row: SubscriptionRow,
): SubscriptionSnapshot {
  return {
    subscriptionId:
      row.subscription_id,
    customerId: row.customer_id,
    accountId: row.account_id,
    state: row.state,
    planId: row.plan_id,
    entitlementIds:
      row.entitlement_ids ?? [],
    currentPeriodStart:
      Number(row.current_period_start),
    currentPeriodEnd:
      Number(row.current_period_end),
    cancelAtPeriodEnd:
      row.cancel_at_period_end,
    updatedAt: Date.now(),
    source: row.source,
  };
}

export class PostgresSubscriptionStore {
  async getByAccountId(
    accountId: string,
  ): Promise<SubscriptionSnapshot | null> {
    const result =
      await query<SubscriptionRow>(
        `
        SELECT
          subscription_id,
          customer_id,
          account_id,
          state,
          plan_id,
          entitlement_ids,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          source
        FROM ecc_subscriptions
        WHERE account_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
        `,
        [accountId],
      );

    const row = result.rows[0];

    return row
      ? rowToSubscription(row)
      : null;
  }

  async getBySubscriptionId(
    subscriptionId: string,
  ): Promise<SubscriptionSnapshot | null> {
    const result =
      await query<SubscriptionRow>(
        `
        SELECT
          subscription_id,
          customer_id,
          account_id,
          state,
          plan_id,
          entitlement_ids,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          source
        FROM ecc_subscriptions
        WHERE subscription_id = $1
        LIMIT 1
        `,
        [subscriptionId],
      );

    const row = result.rows[0];

    return row
      ? rowToSubscription(row)
      : null;
  }

  async upsert(
    snapshot: SubscriptionSnapshot,
  ): Promise<void> {
    await query(
      `
      INSERT INTO ecc_accounts (id)
      VALUES ($1)
      ON CONFLICT (id)
      DO UPDATE SET updated_at = NOW()
      `,
      [snapshot.accountId],
    );

    await query(
      `
      INSERT INTO ecc_subscriptions (
        subscription_id,
        customer_id,
        account_id,
        state,
        plan_id,
        entitlement_ids,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        source,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,NOW()
      )
      ON CONFLICT (subscription_id)
      DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        account_id = EXCLUDED.account_id,
        state = EXCLUDED.state,
        plan_id = EXCLUDED.plan_id,
        entitlement_ids = EXCLUDED.entitlement_ids,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        source = EXCLUDED.source,
        updated_at = NOW()
      `,
      [
        snapshot.subscriptionId,
        snapshot.customerId,
        snapshot.accountId,
        snapshot.state,
        snapshot.planId,
        JSON.stringify(
          snapshot.entitlementIds,
        ),
        snapshot.currentPeriodStart,
        snapshot.currentPeriodEnd,
        snapshot.cancelAtPeriodEnd,
        snapshot.source,
      ],
    );
  }
}

export class PostgresBillingEventStore {
  async begin(
    event: {
      eventId: string;
      eventType: string;
      occurredAt: number;
      customerId: string | null;
      subscriptionId: string | null;
      payloadHash: string;
      payload?: unknown;
    },
  ): Promise<{
    status: "new" | "duplicate";
    eventId: string;
    firstProcessedAt: number | null;
  }> {
    const result =
      await query<{
        event_id: string;
        processed_at: string | null;
      }>(
        `
        INSERT INTO ecc_billing_events (
          event_id,
          event_type,
          occurred_at,
          customer_id,
          subscription_id,
          payload_hash,
          payload
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7::jsonb
        )
        ON CONFLICT (event_id)
        DO NOTHING
        RETURNING event_id, processed_at
        `,
        [
          event.eventId,
          event.eventType,
          event.occurredAt,
          event.customerId,
          event.subscriptionId,
          event.payloadHash,
          JSON.stringify(
            event.payload ?? null,
          ),
        ],
      );

    if (result.rows.length > 0) {
      return {
        status: "new",
        eventId: event.eventId,
        firstProcessedAt: null,
      };
    }

    const existing =
      await query<{
        event_id: string;
        processed_at: string | null;
      }>(
        `
        SELECT event_id, processed_at
        FROM ecc_billing_events
        WHERE event_id = $1
        LIMIT 1
        `,
        [event.eventId],
      );

    return {
      status: "duplicate",
      eventId: event.eventId,
      firstProcessedAt:
        existing.rows[0]?.processed_at
          ? Number(
              existing.rows[0]
                .processed_at,
            )
          : null,
    };
  }

  async markProcessed(
    eventId: string,
    processedAt: number,
  ): Promise<void> {
    await query(
      `
      UPDATE ecc_billing_events
      SET processed_at = $2
      WHERE event_id = $1
      `,
      [eventId, processedAt],
    );
  }
}

export type PostgresUsageScope = {
  accountId: string;
  userId: string;
  capability: string;
  periodKey: string;
};

type UsageRow = {
  committed: string;
  reserved: string;
};

function usageKey(
  scope: PostgresUsageScope,
): string[] {
  return [
    scope.accountId,
    scope.userId,
    scope.capability,
    scope.periodKey,
  ];
}

export class PostgresUsageStore {
  async read(
    scope: PostgresUsageScope,
  ): Promise<{
    committed: number;
    reserved: number;
    updatedAt: number;
  }> {
    const result =
      await query<UsageRow>(
        `
        SELECT committed, reserved
        FROM ecc_usage_counters
        WHERE
          account_id = $1
          AND user_id = $2
          AND capability = $3
          AND period_key = $4
        LIMIT 1
        `,
        usageKey(scope),
      );

    const row = result.rows[0];

    return {
      committed: Number(
        row?.committed ?? 0,
      ),
      reserved: Number(
        row?.reserved ?? 0,
      ),
      updatedAt: Date.now(),
    };
  }

  /**
   * Buyer-provider quota is taken from server-side plan policy.
   *
   * authorizedPlan MUST originate from an already verified
   * subscription; callers must never forward a client-supplied plan.
   *
   * The counter row is locked before evaluating quota.
   * Concurrent reservations for the same scope are serialized.
   */
  async reserve(input: {
    scope: PostgresUsageScope;
    reservationId: string;
    amount: number;
    reservedAt: number;
    expiresAt: number;
    authorizedPlan: CommercialPlan;
  }): Promise<{
    accepted: boolean;
    committed: number;
    reserved: number;
  }> {
    if (
      input.scope.capability !== "buyer_intelligence" ||
      !["pro_monthly", "pro_yearly"].includes(input.authorizedPlan) ||
      !Number.isSafeInteger(input.amount) ||
      input.amount <= 0 ||
      !Number.isSafeInteger(input.reservedAt) ||
      !Number.isSafeInteger(input.expiresAt) ||
      input.expiresAt <= input.reservedAt ||
      !input.reservationId.trim() ||
      !input.scope.periodKey.trim()
    ) {
      return {
        accepted: false,
        committed: 0,
        reserved: 0,
      };
    }

    const limit = getMonthlyEquivalentLimit(
      input.authorizedPlan,
      "buyer_provider_queries",
    );

    if (!Number.isSafeInteger(limit) || limit <= 0) {
      return {
        accepted: false,
        committed: 0,
        reserved: 0,
      };
    }

    return withTransaction(async (client) => {
      /*
       * Serialize every buyer reservation for this account and period,
       * including reservations made by different users.
       *
       * A hash collision only adds serialization; it cannot grant quota.
       */
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [
          JSON.stringify([
            "ecc-buyer-quota-v16",
            input.scope.accountId,
            input.scope.capability,
            input.scope.periodKey,
          ]),
        ],
      );

      await ensureAccountAndUser(
        client,
        input.scope.accountId,
        input.scope.userId,
      );

      // Establish a lockable row even for first-time usage.
      await client.query(
        `
        INSERT INTO ecc_usage_counters (
          account_id,
          user_id,
          capability,
          period_key,
          committed,
          reserved
        )
        VALUES ($1,$2,$3,$4,0,0)
        ON CONFLICT (
          account_id,
          user_id,
          capability,
          period_key
        )
        DO NOTHING
        `,
        usageKey(input.scope),
      );

      const locked = await client.query<UsageRow>(
        `
        SELECT committed, reserved
        FROM ecc_usage_counters
        WHERE
          account_id = $1
          AND user_id = $2
          AND capability = $3
          AND period_key = $4
        FOR UPDATE
        `,
        usageKey(input.scope),
      );

      const current = locked.rows[0];

      if (!current) {
        throw new Error("usage_counter_lock_failed");
      }

      const committed = Number(current.committed);
      const reserved = Number(current.reserved);

      if (
        !Number.isSafeInteger(committed) ||
        !Number.isSafeInteger(reserved) ||
        committed < 0 ||
        reserved < 0
      ) {
        throw new Error("invalid_usage_counter");
      }

      /*
       * The user counter is retained for individual accounting.
       * Authorization uses the combined consumption of the account.
       *
       * This query runs while the account-period advisory lock is held.
       */
      const aggregate = await client.query<{
        committed: string;
        reserved: string;
      }>(
        `
        SELECT
          COALESCE(SUM(committed), 0)::text AS committed,
          COALESCE(SUM(reserved), 0)::text AS reserved
        FROM ecc_usage_counters
        WHERE account_id = $1
          AND capability = $2
          AND period_key = $3
        `,
        [
          input.scope.accountId,
          input.scope.capability,
          input.scope.periodKey,
        ],
      );

      const accountCommitted = Number(
        aggregate.rows[0]?.committed,
      );
      const accountReserved = Number(
        aggregate.rows[0]?.reserved,
      );

      if (
        !Number.isSafeInteger(accountCommitted) ||
        !Number.isSafeInteger(accountReserved) ||
        accountCommitted < 0 ||
        accountReserved < 0
      ) {
        throw new Error("invalid_account_usage_counter");
      }

      if (
        input.amount > limit ||
        accountCommitted > limit - accountReserved - input.amount
      ) {
        return {
          accepted: false,
          committed,
          reserved,
        };
      }

      const inserted = await client.query<{
        reservation_id: string;
      }>(
        `
        INSERT INTO ecc_usage_reservations (
          reservation_id,
          account_id,
          user_id,
          capability,
          period_key,
          amount,
          status,
          reserved_at,
          expires_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,'reserved',$7,$8
        )
        ON CONFLICT (reservation_id)
        DO NOTHING
        RETURNING reservation_id
        `,
        [
          input.reservationId,
          ...usageKey(input.scope),
          input.amount,
          input.reservedAt,
          input.expiresAt,
        ],
      );

      if (inserted.rows.length !== 1) {
        return {
          accepted: false,
          committed,
          reserved,
        };
      }

      await client.query(
        `
        UPDATE ecc_usage_counters
        SET
          reserved = reserved + $5,
          updated_at = NOW()
        WHERE
          account_id = $1
          AND user_id = $2
          AND capability = $3
          AND period_key = $4
        `,
        [
          ...usageKey(input.scope),
          input.amount,
        ],
      );

      return {
        accepted: true,
        committed,
        reserved: reserved + input.amount,
      };
    });
  }

  async commit(
    input: {
      scope: PostgresUsageScope;
      reservationId: string;
      amount: number;
    },
  ): Promise<{
    committed: boolean;
    record: {
      committed: number;
      reserved: number;
    };
  }> {
    return withTransaction(
      async (client) => {
        const reservation =
          await client.query<{
            amount: string;
            status: string;
          }>(
            `
            SELECT amount, status
            FROM ecc_usage_reservations
            WHERE
              reservation_id = $1
              AND account_id = $2
              AND user_id = $3
              AND capability = $4
              AND period_key = $5
            FOR UPDATE
            `,
            [
              input.reservationId,
              ...usageKey(
                input.scope,
              ),
            ],
          );

        const row =
          reservation.rows[0];

        if (
          !row ||
          row.status !== "reserved"
        ) {
          const current =
            await readUsageClient(
              client,
              input.scope,
            );

          return {
            committed: false,
            record: current,
          };
        }

        const amount = Number(
          row.amount,
        );

        await client.query(
          `
          UPDATE ecc_usage_counters
          SET
            committed = committed + $5,
            reserved = GREATEST(
              0,
              reserved - $5
            ),
            updated_at = NOW()
          WHERE
            account_id = $1
            AND user_id = $2
            AND capability = $3
            AND period_key = $4
          `,
          [
            ...usageKey(
              input.scope,
            ),
            amount,
          ],
        );

        await client.query(
          `
          UPDATE ecc_usage_reservations
          SET status = 'committed'
          WHERE reservation_id = $1
          `,
          [input.reservationId],
        );

        const current =
          await readUsageClient(
            client,
            input.scope,
          );

        return {
          committed: true,
          record: current,
        };
      },
    );
  }

  async release(
    input: {
      scope: PostgresUsageScope;
      reservationId: string;
      amount: number;
    },
  ): Promise<{
    released: boolean;
    record: {
      committed: number;
      reserved: number;
    };
  }> {
    return withTransaction(
      async (client) => {
        const reservation =
          await client.query<{
            amount: string;
            status: string;
          }>(
            `
            SELECT amount, status
            FROM ecc_usage_reservations
            WHERE
              reservation_id = $1
              AND account_id = $2
              AND user_id = $3
              AND capability = $4
              AND period_key = $5
            FOR UPDATE
            `,
            [
              input.reservationId,
              ...usageKey(
                input.scope,
              ),
            ],
          );

        const row =
          reservation.rows[0];

        if (
          !row ||
          row.status !== "reserved"
        ) {
          const current =
            await readUsageClient(
              client,
              input.scope,
            );

          return {
            released: false,
            record: current,
          };
        }

        const amount = Number(row.amount);

        if (
          !Number.isSafeInteger(amount) ||
          amount <= 0
        ) {
          throw new Error(
            "invalid_usage_reservation_amount",
          );
        }

        await client.query(
          `
          UPDATE ecc_usage_counters
          SET
            reserved = GREATEST(
              0,
              reserved - $5
            ),
            updated_at = NOW()
          WHERE
            account_id = $1
            AND user_id = $2
            AND capability = $3
            AND period_key = $4
          `,
          [
            ...usageKey(
              input.scope,
            ),
            amount,
          ],
        );

        await client.query(
          `
          UPDATE ecc_usage_reservations
          SET status = 'released'
          WHERE reservation_id = $1
          `,
          [input.reservationId],
        );

        const current =
          await readUsageClient(
            client,
            input.scope,
          );

        return {
          released: true,
          record: current,
        };
      },
    );
  }
}

async function ensureAccountAndUser(
  client: ClientBase,
  accountId: string,
  userId: string,
): Promise<void> {
  /*
   * Usage accounting must NEVER create identities or memberships.
   * Membership must already exist through trusted provisioning.
   *
   * Lock the membership row for the reservation transaction.
   * Concurrent membership deletion must not race this validation.
   */
  const membership = await client.query(
    `
    SELECT 1
    FROM ecc_account_members
    WHERE account_id = $1
      AND user_id = $2
    FOR SHARE
    `,
    [accountId, userId],
  );

  if (membership.rows.length !== 1) {
    throw new Error(
      "usage_account_membership_not_verified",
    );
  }
}

async function readUsageClient(
  client: ClientBase,
  scope: PostgresUsageScope,
): Promise<{
  committed: number;
  reserved: number;
  updatedAt: number;
}> {
  const result =
    await client.query<UsageRow>(
      `
      SELECT committed, reserved
      FROM ecc_usage_counters
      WHERE
        account_id = $1
        AND user_id = $2
        AND capability = $3
        AND period_key = $4
      LIMIT 1
      `,
      usageKey(scope),
    );

  const row =
    result.rows[0];

  return {
    committed: Number(
      row?.committed ?? 0,
    ),
    reserved: Number(
      row?.reserved ?? 0,
    ),
    updatedAt: Date.now(),
  };
}
