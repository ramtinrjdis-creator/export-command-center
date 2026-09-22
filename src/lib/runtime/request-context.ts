import { randomUUID } from "node:crypto";

export function createRequestId(prefix = "ecc") {
  return `${prefix}_${randomUUID()}`;
}

export function startRequestTimer() {
  return performance.now();
}

export function getDurationMs(startedAt: number) {
  return Math.max(
    0,
    Math.round(performance.now() - startedAt)
  );
}

export function buildRequestMeta(
  requestId: string,
  startedAt: number
) {
  return {
    requestId,
    durationMs: getDurationMs(startedAt),
    timestamp: new Date().toISOString(),
  };
}
