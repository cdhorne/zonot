// The outbox sync worker (mobile-spec §3.2). Claims due rows, posts each to the
// Worker, and records the outcome: synced / retry-with-backoff / failed-permanent.
// Triggered on foreground, connectivity-change, and a manual "retry now".

import type { WorkerClient } from '@zonot/core/edge';
import type { WriteResult } from '@zonot/core/schema';
import type { Outbox, OutboxRow } from './outbox.ts';
import { nextAttemptAt } from './retry.ts';

const BATCH = 10;

export interface TickResult {
  synced: number;
  retried: number;
  failed: number;
}

export interface SyncHooks {
  /** Called after a row is marked SYNCED — used to reconcile the local mirror
   *  (a provisional capture gets rebuilt under its real server id). */
  onSynced?: (row: OutboxRow, result: WriteResult) => void;
}

export class SyncWorker {
  readonly #outbox: Outbox;
  readonly #client: WorkerClient;
  readonly #now: () => number;
  readonly #hooks: SyncHooks;

  constructor(
    outbox: Outbox,
    client: WorkerClient,
    now: () => number = Date.now,
    hooks: SyncHooks = {},
  ) {
    this.#outbox = outbox;
    this.#client = client;
    this.#now = now;
    this.#hooks = hooks;
  }

  async tick(): Promise<TickResult> {
    const due = this.#outbox.claimDue(new Date(this.#now()).toISOString(), BATCH);
    const result: TickResult = { synced: 0, retried: 0, failed: 0 };

    for (const row of due) {
      const outcome = await this.#client.send({
        op: row.op,
        ...(row.target_id ? { id: row.target_id } : {}),
        payload: JSON.parse(row.payload_json),
        idempotencyKey: row.idempotency_key,
      });
      const stamp = new Date(this.#now()).toISOString();

      switch (outcome.kind) {
        case 'synced':
          this.#outbox.markSynced(row.id, outcome.result.commit_sha);
          this.#hooks.onSynced?.(row, outcome.result);
          result.synced++;
          break;
        case 'conflict':
        // 412: a stale base_sha. Auto refetch-and-reapply is a follow-up; for now
        // the edit is surfaced as failed so the user can re-issue it. (falls through)
        case 'permanent':
          this.#outbox.markPermanent(row.id, stamp, JSON.stringify(outcome.problem));
          result.failed++;
          break;
        case 'retry': {
          const attempts = row.attempts + 1;
          this.#outbox.markRetry(
            row.id,
            attempts,
            nextAttemptAt(this.#now(), attempts, outcome.retryAfter),
            stamp,
            outcome.problem ? JSON.stringify(outcome.problem) : null,
          );
          result.retried++;
          break;
        }
      }
    }
    return result;
  }
}
