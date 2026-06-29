// op-sqlite SqliteAdapter — the on-device driver behind the core SqliteAdapter
// seam (same contract the CLI's bun/node adapters satisfy). FTS5 is enabled in
// package.json (`op-sqlite.fts5`); NO SQLCipher — observability is the trust
// mechanism, not encryption (ADR-0001). RN-only; never imported by test logic.

import { open, type Scalar } from '@op-engineering/op-sqlite';
import type { SqliteAdapter, SqliteStatement } from '@zonot/core/fts';

export function openOpSqlite(name: string): SqliteAdapter {
  const db = open({ name });
  db.executeSync('PRAGMA journal_mode = WAL');
  db.executeSync('PRAGMA foreign_keys = ON');

  // op-sqlite's PreparedStatement.execute is async; the core contract is sync, so
  // each call runs executeSync (the driver compiles + caches internally).
  const prepare = (sql: string): SqliteStatement => ({
    run(...params) {
      const r = db.executeSync(sql, params as Scalar[]);
      return { changes: r.rowsAffected, lastInsertRowid: r.insertId ?? 0 };
    },
    get<T = Record<string, unknown>>(...params: ReadonlyArray<unknown>): T | undefined {
      return db.executeSync(sql, params as Scalar[]).rows[0] as T | undefined;
    },
    all<T = Record<string, unknown>>(...params: ReadonlyArray<unknown>): T[] {
      return db.executeSync(sql, params as Scalar[]).rows as T[];
    },
  });

  // Reentrant transactions via BEGIN/SAVEPOINT (op-sqlite has no sync helper, and
  // the IndexWriter nests per-upsert transactions inside a rebuild transaction).
  let depth = 0;
  const transaction = <T>(fn: () => T): T => {
    const outer = depth === 0;
    const sp = `zsp_${depth}`;
    db.executeSync(outer ? 'BEGIN' : `SAVEPOINT ${sp}`);
    depth++;
    try {
      const r = fn();
      depth--;
      db.executeSync(outer ? 'COMMIT' : `RELEASE ${sp}`);
      return r;
    } catch (e) {
      depth--;
      db.executeSync(outer ? 'ROLLBACK' : `ROLLBACK TO ${sp}`);
      throw e;
    }
  };

  return {
    exec: (sql) => {
      db.executeSync(sql);
    },
    prepare,
    transaction,
    close: () => db.close(),
  };
}
