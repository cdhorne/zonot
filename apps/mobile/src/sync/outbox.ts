// The capture outbox (mobile-spec §3.3) — the durable, ordered queue of pending
// writes to the Worker. Pure SqliteAdapter (from @zonot/core/fts), so it's
// testable with the bun:sqlite adapter and runs on op-sqlite on device.

import type { WriteOp } from '@zonot/core/edge';
import type { SqliteAdapter } from '@zonot/core/fts';

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed-permanent';

export interface OutboxRow {
  id: string;
  workspace: string;
  op: WriteOp;
  target_id: string | null; // note id for append/correct/undo/delete; null for capture
  payload_json: string;
  idempotency_key: string;
  created_at: string;
  attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string;
  status: OutboxStatus;
  last_error: string | null;
  commit_sha: string | null;
}

export interface OutboxEntry {
  id: string;
  workspace: string;
  op: WriteOp;
  targetId?: string | undefined;
  payload: unknown;
  idempotencyKey: string;
  createdAt: string;
}

// One statement per entry — some drivers (op-sqlite) run only the first
// statement of a multi-statement exec.
const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS outbox (
    id              TEXT PRIMARY KEY,
    workspace       TEXT NOT NULL,
    op              TEXT NOT NULL,
    target_id       TEXT,
    payload_json    TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,
    next_attempt_at TEXT NOT NULL,
    status          TEXT NOT NULL,
    last_error      TEXT,
    commit_sha      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS outbox_status_next ON outbox(status, next_attempt_at)`,
];

export class Outbox {
  readonly #db: SqliteAdapter;
  constructor(adapter: SqliteAdapter) {
    this.#db = adapter;
  }

  ensureSchema(): void {
    for (const ddl of DDL_STATEMENTS) this.#db.exec(ddl);
  }

  /** Insert a pending write; next_attempt_at = createdAt → eligible immediately. */
  enqueue(entry: OutboxEntry): void {
    this.#db
      .prepare(
        `INSERT INTO outbox(id, workspace, op, target_id, payload_json, idempotency_key,
            created_at, attempts, next_attempt_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending')`,
      )
      .run(
        entry.id,
        entry.workspace,
        entry.op,
        entry.targetId ?? null,
        JSON.stringify(entry.payload),
        entry.idempotencyKey,
        entry.createdAt,
        entry.createdAt,
      );
  }

  /** A crash can leave rows 'syncing'; reset them to 'pending' on boot. */
  resetInFlight(): void {
    this.#db.prepare(`UPDATE outbox SET status = 'pending' WHERE status = 'syncing'`).run();
  }

  /** Claim due pending rows (oldest first), marking them 'syncing'. */
  claimDue(nowIso: string, limit: number): OutboxRow[] {
    const rows = this.#db
      .prepare(
        `SELECT * FROM outbox WHERE status = 'pending' AND next_attempt_at <= ?
          ORDER BY created_at LIMIT ?`,
      )
      .all<OutboxRow>(nowIso, limit);
    const claim = this.#db.prepare(`UPDATE outbox SET status = 'syncing' WHERE id = ?`);
    this.#db.transaction(() => {
      for (const r of rows) claim.run(r.id);
    });
    return rows;
  }

  markSynced(id: string, commitSha: string): void {
    this.#db
      .prepare(
        `UPDATE outbox SET status = 'synced', commit_sha = ?, last_error = NULL WHERE id = ?`,
      )
      .run(commitSha, id);
  }

  markRetry(
    id: string,
    attempts: number,
    nextAttemptAt: string,
    nowIso: string,
    lastError: string | null,
  ): void {
    this.#db
      .prepare(
        `UPDATE outbox SET status = 'pending', attempts = ?, next_attempt_at = ?,
            last_attempt_at = ?, last_error = ? WHERE id = ?`,
      )
      .run(attempts, nextAttemptAt, nowIso, lastError, id);
  }

  markPermanent(id: string, nowIso: string, lastError: string): void {
    this.#db
      .prepare(
        `UPDATE outbox SET status = 'failed-permanent', last_attempt_at = ?, last_error = ? WHERE id = ?`,
      )
      .run(nowIso, lastError, id);
  }

  pendingCount(): number {
    return (
      this.#db
        .prepare(`SELECT COUNT(*) AS n FROM outbox WHERE status IN ('pending', 'syncing')`)
        .get<{ n: number }>()?.n ?? 0
    );
  }

  failedCount(): number {
    return (
      this.#db
        .prepare(`SELECT COUNT(*) AS n FROM outbox WHERE status = 'failed-permanent'`)
        .get<{ n: number }>()?.n ?? 0
    );
  }

  /** Recent rows for the Sync Details screen (newest first). */
  recent(limit: number): OutboxRow[] {
    return this.#db
      .prepare(`SELECT * FROM outbox ORDER BY created_at DESC LIMIT ?`)
      .all<OutboxRow>(limit);
  }
}
