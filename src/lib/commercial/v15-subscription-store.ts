import type {
  SubscriptionSnapshot,
} from "./v15-types";

export type SubscriptionStore = {
  getByAccountId(
    accountId: string,
  ): Promise<SubscriptionSnapshot | null>;

  getBySubscriptionId(
    subscriptionId: string,
  ): Promise<SubscriptionSnapshot | null>;

  upsert(
    snapshot: SubscriptionSnapshot,
  ): Promise<void>;
};

export class InMemorySubscriptionStore
  implements SubscriptionStore
{
  private readonly records = new Map<
    string,
    SubscriptionSnapshot
  >();

  async getByAccountId(
    accountId: string,
  ): Promise<SubscriptionSnapshot | null> {
    return this.records.get(accountId) ?? null;
  }

  async getBySubscriptionId(
    subscriptionId: string,
  ): Promise<SubscriptionSnapshot | null> {
    for (const record of this.records.values()) {
      if (record.subscriptionId === subscriptionId) {
        return record;
      }
    }

    return null;
  }

  async upsert(
    snapshot: SubscriptionSnapshot,
  ): Promise<void> {
    this.records.set(snapshot.accountId, snapshot);
  }
}

export function assertProductionSubscriptionStore(
  store: SubscriptionStore | null | undefined,
): SubscriptionStore {
  if (!store) {
    throw new Error(
      "Production subscription storage is not configured.",
    );
  }

  return store;
}
