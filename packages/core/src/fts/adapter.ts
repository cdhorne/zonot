// SqliteAdapter — the driver-injection seam.
// Concrete adapters live in the runtimes:
//   - CLI:     bun:sqlite (FTS5 default)
//   - mobile:  op-sqlite with the FTS5 build flag
//   - edge:    Cloudflare Durable Object SQLite (v1.2)
// The core consumes adapters; it never imports a driver directly.

export interface SqliteRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface SqliteStatement {
  /** Execute a statement that returns no rows. */
  run(...params: ReadonlyArray<unknown>): SqliteRunResult;
  /** Fetch a single row or undefined. */
  get<T = Record<string, unknown>>(...params: ReadonlyArray<unknown>): T | undefined;
  /** Fetch all rows. */
  all<T = Record<string, unknown>>(...params: ReadonlyArray<unknown>): T[];
}

export interface SqliteAdapter {
  /** Execute DDL or other statements that ignore results. */
  exec(sql: string): void;
  /** Prepare a parameterized statement for reuse. */
  prepare(sql: string): SqliteStatement;
  /** Run a function inside a transaction; rolls back on throw. */
  transaction<T>(fn: () => T): T;
  /** Release the underlying handle. */
  close(): void;
}
