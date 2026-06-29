import { beforeEach, describe, expect, test } from 'bun:test';
import type { SendOutcome, WorkerClient } from '@zonot/core/edge';
// Reuse the core FTS bun:sqlite adapter (test-only deep import).
import { openBunAdapter } from '../../../../../packages/core/src/fts/__tests__/bun-adapter.ts';
import { Outbox, type OutboxRow } from '../outbox.ts';
import { backoffSeconds, nextAttemptAt } from '../retry.ts';
import { SyncWorker } from '../worker.ts';

const NOW = Date.parse('2026-06-14T12:00:00.000Z');
const result = (id: string) => ({
  id,
  path: 'notes/x.md',
  commit_sha: `sha-${id}`,
  applied_tags: [],
  capture_id: id,
});

/** A WorkerClient stub that returns a fixed outcome keyed by idempotency-key. */
function fakeClient(byKey: Record<string, SendOutcome>): WorkerClient {
  return {
    send: async (req) => byKey[req.idempotencyKey ?? ''] ?? { kind: 'retry' },
  } as unknown as WorkerClient;
}

function enqueue(outbox: Outbox, id: string, key: string) {
  outbox.enqueue({
    id,
    workspace: 'personal',
    op: 'capture',
    payload: { output: { body: id } },
    idempotencyKey: key,
    createdAt: new Date(NOW).toISOString(),
  });
}

describe('retry backoff (§3.4)', () => {
  test('1,2,4,8,30,300,1800 then caps at 1800', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(backoffSeconds)).toEqual([1, 2, 4, 8, 30, 300, 1800, 1800]);
  });
  test('nextAttemptAt honors a longer server Retry-After', () => {
    expect(nextAttemptAt(NOW, 1, 60)).toBe(new Date(NOW + 60_000).toISOString()); // 60 > backoff 1s
  });
});

describe('SyncWorker.tick', () => {
  let outbox: Outbox;

  beforeEach(() => {
    outbox = new Outbox(openBunAdapter());
    outbox.ensureSchema();
  });

  test('synced / retry / permanent each update the row correctly', async () => {
    enqueue(outbox, 'a', 'k-synced');
    enqueue(outbox, 'b', 'k-retry');
    enqueue(outbox, 'c', 'k-perm');
    const client = fakeClient({
      'k-synced': { kind: 'synced', result: result('a') },
      'k-retry': { kind: 'retry', retryAfter: 30 },
      'k-perm': {
        kind: 'permanent',
        problem: { type: 't', title: 'x', status: 422, detail: 'replay' },
      },
    });

    const out = await new SyncWorker(outbox, client, () => NOW).tick();
    expect(out).toEqual({ synced: 1, retried: 1, failed: 1 });

    const rows = Object.fromEntries(outbox.recent(10).map((r) => [r.id, r])) as Record<
      string,
      OutboxRow
    >;
    expect(rows.a?.status).toBe('synced');
    expect(rows.a?.commit_sha).toBe('sha-a');
    expect(rows.b?.status).toBe('pending');
    expect(rows.b?.attempts).toBe(1);
    expect(rows.b?.next_attempt_at).toBe(new Date(NOW + 30_000).toISOString());
    expect(rows.c?.status).toBe('failed-permanent');

    expect(outbox.pendingCount()).toBe(1); // b
    expect(outbox.failedCount()).toBe(1); // c
  });

  test('a backed-off row is not re-claimed until its next_attempt_at', async () => {
    enqueue(outbox, 'a', 'k');
    const client = fakeClient({ k: { kind: 'retry', retryAfter: 300 } });
    const worker = new SyncWorker(outbox, client, () => NOW);
    await worker.tick(); // → pending, next attempt in 5m
    expect(await worker.tick()).toEqual({ synced: 0, retried: 0, failed: 0 }); // nothing due yet
  });

  test('resetInFlight requeues rows stuck syncing after a crash', () => {
    enqueue(outbox, 'a', 'k');
    outbox.claimDue(new Date(NOW).toISOString(), 10); // marks 'syncing', then "crash"
    expect(outbox.pendingCount()).toBe(1); // syncing counts as in-flight
    outbox.resetInFlight();
    const due = outbox.claimDue(new Date(NOW).toISOString(), 10);
    expect(due.map((r) => r.id)).toEqual(['a']); // claimable again
  });
});
