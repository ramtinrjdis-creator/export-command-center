import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../persistence/postgres", () => ({
  query: vi.fn(),
}));

import { query } from "../persistence/postgres";
import {
  consumeAbuseBudget,
} from "../persistence/durable-abuse-control";

const db = vi.mocked(query);

const policy = {
  accountId: "account-1",
  userId: "user-1",
  capability: "buyer_intelligence",
  limit: 3,
  windowMs: 60000,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("V16.8I durable abuse control", () => {
  it("accepts the first request through one atomic UPSERT", async () => {
    db.mockResolvedValueOnce({
      rows: [{ used: "1" }],
    } as never);

    expect(await consumeAbuseBudget(policy)).toMatchObject({
      allowed: true,
      used: 1,
    });

    expect(db).toHaveBeenCalledTimes(1);

    const sql = String(db.mock.calls[0][0]);

    expect(sql).toContain("ON CONFLICT (scope_key)");
    expect(sql).toContain("ecc_abuse_counters.count < $3");
    expect(sql).toContain("RETURNING count::text AS used");
  });

  it("denies exhausted budgets without another increment", async () => {
    db.mockResolvedValueOnce({
      rows: [],
    } as never);

    expect(await consumeAbuseBudget(policy)).toMatchObject({
      allowed: false,
      used: null,
    });
  });

  it("uses distinct keys for different account members", async () => {
    db.mockResolvedValue({
      rows: [{ used: "1" }],
    } as never);

    await consumeAbuseBudget(policy);
    await consumeAbuseBudget({
      ...policy,
      userId: "user-2",
    });

    expect(db.mock.calls[0][1]?.[0])
      .not.toEqual(db.mock.calls[1][1]?.[0]);
  });

  it("moves to the next fixed time window", async () => {
    db.mockResolvedValue({
      rows: [{ used: "1" }],
    } as never);

    const first = await consumeAbuseBudget(policy);

    vi.advanceTimersByTime(60000);

    const second = await consumeAbuseBudget(policy);

    expect(second.windowStartedAt - first.windowStartedAt)
      .toBe(60000);
  });

  it("rejects invalid policies before accessing PostgreSQL", async () => {
    await expect(consumeAbuseBudget({
      ...policy,
      limit: 0,
    })).rejects.toThrow("invalid_abuse_budget_policy");

    expect(db).not.toHaveBeenCalled();
  });

  it("fails closed on database errors", async () => {
    db.mockRejectedValueOnce(
      new Error("database_unavailable"),
    );

    await expect(consumeAbuseBudget(policy))
      .rejects.toThrow("database_unavailable");
  });

  it("rejects inconsistent counter results", async () => {
    db.mockResolvedValueOnce({
      rows: [{ used: "4" }],
    } as never);

    await expect(consumeAbuseBudget(policy))
      .rejects.toThrow("invalid_abuse_budget_counter");
  });
});
