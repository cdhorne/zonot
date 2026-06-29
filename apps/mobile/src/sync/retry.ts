// Outbox retry/backoff (mobile-spec §3.4): 1s, 2s, 4s, 8s, 30s, 5m, 30m, then
// 30m forever. Honors a server Retry-After when it asks for longer.

const SCHEDULE_SECONDS = [1, 2, 4, 8, 30, 300, 1800] as const;

/** Backoff delay (seconds) before the Nth attempt (attempt is 1-based). */
export function backoffSeconds(attempt: number): number {
  const i = Math.min(Math.max(attempt, 1), SCHEDULE_SECONDS.length) - 1;
  return SCHEDULE_SECONDS[i] ?? 1800;
}

/** ISO timestamp for the next attempt: max(backoff, server Retry-After). */
export function nextAttemptAt(nowMs: number, attempt: number, retryAfterSeconds?: number): string {
  const delay = Math.max(backoffSeconds(attempt), retryAfterSeconds ?? 0);
  return new Date(nowMs + delay * 1000).toISOString();
}
