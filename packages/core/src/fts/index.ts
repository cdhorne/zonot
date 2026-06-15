// Public surface for @zonot/core/fts.
// Consumers inject a SqliteAdapter (bun:sqlite, op-sqlite, or DO SQLite).

export type { SqliteAdapter, SqliteRunResult, SqliteStatement } from './adapter.ts';
export { DDL_STATEMENTS, FTS_SCHEMA_VERSION } from './ddl.ts';
export type {
  IndexableNote,
  IndexableSource,
  RebuildStats,
} from './index-writer.ts';
export { IndexWriter } from './index-writer.ts';
export { SearchEngine } from './search-engine.ts';
