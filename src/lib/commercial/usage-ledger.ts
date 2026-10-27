import type {
  CommercialPlan,
  UsageMetric,
} from "./plan-policy";
import {
  evaluateUsage,
  type UsageDecision,
} from "./usage-policy";

export type UsageLedgerState = {
  used: number;
  reserved: number;
};

type Reservation = {
  id: string;
  userId: string;
  metric: UsageMetric;
  amount: number;
  expiresAt: number;
};

const states = new Map<
  string,
  UsageLedgerState
>();

const reservations = new Map<
  string,
  Reservation
>();

function stateKey(
  userId: string,
  metric: UsageMetric,
) {
  return `${userId}:${metric}`;
}

function getState(
  userId: string,
  metric: UsageMetric,
) {
  const key = stateKey(
    userId,
    metric,
  );

  const current = states.get(key) ?? {
    used: 0,
    reserved: 0,
  };

  states.set(key, current);
  return current;
}

function sweep(now = Date.now()) {
  for (const [
    id,
    reservation,
  ] of reservations.entries()) {
    if (reservation.expiresAt <= now) {
      const current = getState(
        reservation.userId,
        reservation.metric,
      );

      current.reserved = Math.max(
        0,
        current.reserved -
          reservation.amount,
      );

      reservations.delete(id);
    }
  }
}

export function checkUsage(
  plan: CommercialPlan,
  userId: string,
  metric: UsageMetric,
): UsageDecision {
  sweep();

  const current = getState(
    userId,
    metric,
  );

  return evaluateUsage(
    plan,
    metric,
    {
      metric,
      used: current.used,
      reserved: current.reserved,
    },
  );
}

export function reserveUsage(input: {
  plan: CommercialPlan;
  userId: string;
  metric: UsageMetric;
  amount?: number;
  ttlMs?: number;
}) {
  sweep();

  const amount =
    input.amount ?? 1;

  if (
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    return {
      allowed: false as const,
      reason: "invalid_amount" as const,
    };
  }

  const current = getState(
    input.userId,
    input.metric,
  );

  const decision = evaluateUsage(
    input.plan,
    input.metric,
    {
      metric: input.metric,
      used: current.used,
      reserved: current.reserved,
    },
  );

  if (!decision.allowed) {
    return decision;
  }

  const remainingAfterReserve =
    decision.remaining - amount;

  if (remainingAfterReserve < 0) {
    return {
      allowed: false as const,
      remaining: 0,
      limit: decision.limit,
      reason: "limit_reached" as const,
    };
  }

  const id = `${input.userId}:${input.metric}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  const reservation: Reservation = {
    id,
    userId: input.userId,
    metric: input.metric,
    amount,
    expiresAt:
      Date.now() +
      (input.ttlMs ?? 30_000),
  };

  reservations.set(id, reservation);
  current.reserved += amount;

  return {
    allowed: true as const,
    id,
    remaining: remainingAfterReserve,
    limit: decision.limit,
  };
}

export function commitUsage(
  reservationId: string,
) {
  sweep();

  const reservation =
    reservations.get(
      reservationId,
    );

  if (!reservation) {
    return {
      committed: false as const,
      reason: "reservation_missing" as const,
    };
  }

  const current = getState(
    reservation.userId,
    reservation.metric,
  );

  current.reserved = Math.max(
    0,
    current.reserved -
      reservation.amount,
  );

  current.used +=
    reservation.amount;

  reservations.delete(
    reservationId,
  );

  return {
    committed: true as const,
    amount: reservation.amount,
    metric: reservation.metric,
  };
}

export function releaseUsage(
  reservationId: string,
) {
  const reservation =
    reservations.get(
      reservationId,
    );

  if (!reservation) {
    return {
      released: false as const,
      reason: "reservation_missing" as const,
    };
  }

  const current = getState(
    reservation.userId,
    reservation.metric,
  );

  current.reserved = Math.max(
    0,
    current.reserved -
      reservation.amount,
  );

  reservations.delete(
    reservationId,
  );

  return {
    released: true as const,
  };
}

export function clearUsageLedger() {
  states.clear();
  reservations.clear();
}
