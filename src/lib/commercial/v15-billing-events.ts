import { createHash } from "node:crypto";

import type {
  BillingEvent,
  IdempotencyResult,
} from "./v15-types";

export type BillingIdempotencyStore = {
  get(eventId: string): Promise<number | null>;
  markProcessed(eventId: string, processedAt: number): Promise<void>;
};

export class InMemoryBillingIdempotencyStore
  implements BillingIdempotencyStore
{
  private readonly records = new Map<string, number>();

  async get(eventId: string): Promise<number | null> {
    return this.records.get(eventId) ?? null;
  }

  async markProcessed(
    eventId: string,
    processedAt: number,
  ): Promise<void> {
    this.records.set(eventId, processedAt);
  }
}

export function hashBillingPayload(
  payload: string,
): string {
  return createHash("sha256")
    .update(payload, "utf8")
    .digest("hex");
}

export async function beginBillingEvent(
  store: BillingIdempotencyStore,
  event: BillingEvent,
): Promise<IdempotencyResult> {
  const previous = await store.get(event.eventId);

  if (previous !== null) {
    return {
      status: "duplicate",
      eventId: event.eventId,
      firstProcessedAt: previous,
    };
  }

  return {
    status: "new",
    eventId: event.eventId,
  };
}

export async function markBillingEventProcessed(
  store: BillingIdempotencyStore,
  event: BillingEvent,
  processedAt: number,
): Promise<void> {
  await store.markProcessed(
    event.eventId,
    processedAt,
  );
}
