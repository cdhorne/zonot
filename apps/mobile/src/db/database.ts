// The on-device database singletons (mobile-spec §3.1). One op-sqlite handle
// backs both the Mirror (notes content + derived FTS) and the Outbox (pending
// writes). Opened once at app start; derivable/disposable (ADR-0001).

import type { SqliteAdapter } from '@zonot/core/fts';
import { Mirror } from '../mirror/mirror.ts';
import { Outbox } from '../sync/outbox.ts';
import { openOpSqlite } from './opSqliteAdapter.ts';

const DB_NAME = 'zonot.db';

let handles: { mirror: Mirror; outbox: Outbox; adapter: SqliteAdapter } | null = null;

/** Idempotently open the db, create schema, and recover crashed in-flight rows. */
export function initDatabase(): { mirror: Mirror; outbox: Outbox } {
  if (handles) return handles;
  const adapter = openOpSqlite(DB_NAME);
  const mirror = new Mirror(adapter);
  const outbox = new Outbox(adapter);
  mirror.ensureSchema();
  outbox.ensureSchema();
  outbox.resetInFlight(); // a crash can strand rows mid-sync
  handles = { mirror, outbox, adapter };
  return handles;
}

/** Run a function across the shared db handle in one transaction (capture writes
 *  the mirror note + outbox row atomically — mobile-spec §3.2). */
export function transaction<T>(fn: () => T): T {
  return requireHandles().adapter.transaction(fn);
}

export function getMirror(): Mirror {
  return requireHandles().mirror;
}

export function getOutbox(): Outbox {
  return requireHandles().outbox;
}

function requireHandles(): { mirror: Mirror; outbox: Outbox; adapter: SqliteAdapter } {
  if (!handles) throw new Error('database not initialized — call initDatabase() first');
  return handles;
}
