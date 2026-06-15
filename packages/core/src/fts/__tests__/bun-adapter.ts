// Bun-only test helper. Wraps bun:sqlite in a SqliteAdapter so the FTS
// integration tests run against a real SQLite (FTS5 included in Bun's
// vendored build). Not exported from @zonot/core — it imports bun:sqlite
// which is unavailable in workerd / RN.

import { Database } from 'bun:sqlite';
import type { SqliteAdapter, SqliteStatement } from '../adapter.ts';

export function openBunAdapter(): SqliteAdapter {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');

  return {
    exec(sql: string): void {
      db.exec(sql);
    },
    prepare(sql: string): SqliteStatement {
      const stmt = db.prepare(sql);
      return {
        run(...params: ReadonlyArray<unknown>) {
          const result = stmt.run(...(params as unknown[]));
          return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid,
          };
        },
        get<T = Record<string, unknown>>(...params: ReadonlyArray<unknown>): T | undefined {
          return stmt.get(...(params as unknown[])) as T | undefined;
        },
        all<T = Record<string, unknown>>(...params: ReadonlyArray<unknown>): T[] {
          return stmt.all(...(params as unknown[])) as T[];
        },
      };
    },
    transaction<T>(fn: () => T): T {
      return db.transaction(fn)();
    },
    close(): void {
      db.close();
    },
  };
}
