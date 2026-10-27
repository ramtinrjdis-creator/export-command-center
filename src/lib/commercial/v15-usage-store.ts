import type {
  UsageRecord,
  UsageReservation,
  UsageScope,
} from "./v15-types";

export type UsageStore = {
  read(scope: UsageScope): Promise<UsageRecord>;

  reserve(input: {
    scope: UsageScope;
    reservation: UsageReservation;
  }): Promise<{
    accepted: boolean;
    record: UsageRecord;
  }>;

  commit(input: {
    scope: UsageScope;
    reservationId: string;
    amount: number;
  }): Promise<{
    committed: boolean;
    record: UsageRecord;
  }>;

  release(input: {
    scope: UsageScope;
    reservationId: string;
    amount: number;
  }): Promise<{
    released: boolean;
    record: UsageRecord;
  }>;
};

function key(scope: UsageScope): string {
  return [
    scope.accountId,
    scope.userId,
    scope.capability,
    scope.periodKey,
  ].join(":");
}

export class InMemoryUsageStore
  implements UsageStore
{
  private readonly records = new Map<
    string,
    UsageRecord
  >();

  private readonly reservations = new Map<
    string,
    {
      key: string;
      amount: number;
    }
  >();

  async read(
    scope: UsageScope,
  ): Promise<UsageRecord> {
    const existing = this.records.get(key(scope));

    return (
      existing ?? {
        committed: 0,
        reserved: 0,
        updatedAt: Date.now(),
      }
    );
  }

  async reserve(input: {
    scope: UsageScope;
    reservation: UsageReservation;
  }) {
    const scopeKey = key(input.scope);
    const current = await this.read(input.scope);

    const next: UsageRecord = {
      committed: current.committed,
      reserved:
        current.reserved +
        input.reservation.amount,
      updatedAt: Date.now(),
    };

    this.records.set(scopeKey, next);

    this.reservations.set(
      input.reservation.reservationId,
      {
        key: scopeKey,
        amount: input.reservation.amount,
      },
    );

    return {
      accepted: true,
      record: next,
    };
  }

  async commit(input: {
    scope: UsageScope;
    reservationId: string;
    amount: number;
  }) {
    const scopeKey = key(input.scope);
    const current = await this.read(input.scope);
    const reservation =
      this.reservations.get(
        input.reservationId,
      );

    if (!reservation || reservation.key !== scopeKey) {
      return {
        committed: false,
        record: current,
      };
    }

    const next: UsageRecord = {
      committed:
        current.committed + input.amount,
      reserved: Math.max(
        0,
        current.reserved -
          reservation.amount,
      ),
      updatedAt: Date.now(),
    };

    this.records.set(scopeKey, next);
    this.reservations.delete(
      input.reservationId,
    );

    return {
      committed: true,
      record: next,
    };
  }

  async release(input: {
    scope: UsageScope;
    reservationId: string;
    amount: number;
  }) {
    const scopeKey = key(input.scope);
    const current = await this.read(input.scope);
    const reservation =
      this.reservations.get(
        input.reservationId,
      );

    if (!reservation || reservation.key !== scopeKey) {
      return {
        released: false,
        record: current,
      };
    }

    const next: UsageRecord = {
      committed: current.committed,
      reserved: Math.max(
        0,
        current.reserved -
          Math.min(
            reservation.amount,
            input.amount,
          ),
      ),
      updatedAt: Date.now(),
    };

    this.records.set(scopeKey, next);
    this.reservations.delete(
      input.reservationId,
    );

    return {
      released: true,
      record: next,
    };
  }
}

export function assertUsageStore(
  store: UsageStore | null | undefined,
): UsageStore {
  if (!store) {
    throw new Error(
      "Production usage storage is not configured.",
    );
  }

  return store;
}
