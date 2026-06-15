// IndexWriter — populate the local FTS + facet store from notes / sources.
// Rebuild-from-files is always the recovery path; the canonical truth is
// the user's repo (ADR-0001 / CLAUDE.md non-negotiable).

import type { SqliteAdapter } from './adapter.ts';
import { DDL_STATEMENTS, FTS_SCHEMA_VERSION } from './ddl.ts';

export interface IndexableNote {
  id: string;
  path: string;
  title: string;
  type: string;
  thread?: string | undefined;
  workspace: string;
  created: string; // ISO-8601 UTC
  updated?: string | undefined;
  v: number;
  source_id?: string | undefined;
  tags: ReadonlyArray<string>;
  aliases?: ReadonlyArray<string> | undefined;
  /** Full body (compiled + timeline). Indexed into notes_fts.body. */
  body: string;
}

export interface IndexableSource {
  id: string;
  path: string;
  of?: string | undefined;
  created: string;
  source?: string | undefined;
  model?: string | undefined;
  workspace: string;
  v: number;
}

export interface RebuildStats {
  notes: number;
  sources: number;
  ms: number;
  warnings: string[];
}

export class IndexWriter {
  readonly #db: SqliteAdapter;

  constructor(adapter: SqliteAdapter) {
    this.#db = adapter;
  }

  /** Idempotently create tables and seed metadata. Safe to call on every boot. */
  ensureSchema(): void {
    this.#db.transaction(() => {
      for (const ddl of DDL_STATEMENTS) {
        this.#db.exec(ddl);
      }
      this.#db
        .prepare(`INSERT OR REPLACE INTO zonot_meta(k, v) VALUES (?, ?)`)
        .run('schema_version', String(FTS_SCHEMA_VERSION));
      this.#db
        .prepare(`INSERT OR IGNORE INTO zonot_meta(k, v) VALUES (?, ?)`)
        .run('convention_version', '1');
    });
  }

  /** Read the stored FTS schema version, if any. */
  schemaVersion(): number | null {
    const row = this.#db
      .prepare(`SELECT v FROM zonot_meta WHERE k = 'schema_version'`)
      .get<{ v: string }>();
    return row ? Number(row.v) : null;
  }

  upsertNote(note: IndexableNote): void {
    this.#db.transaction(() => {
      const tagsText = note.tags.join(' ');
      const createdYmd = ymd(note.created);
      const createdYm = ym(note.created);
      const updatedYmd = note.updated ? ymd(note.updated) : null;

      // Allocate / preserve the rowid binding between notes_meta and notes_fts.
      const existing = this.#db
        .prepare(`SELECT rowid FROM notes_meta WHERE id = ?`)
        .get<{ rowid: number }>(note.id);
      const rowid = existing?.rowid ?? nextRowid(this.#db);

      this.#db
        .prepare(
          `INSERT INTO notes_meta(
              id, rowid, path, title, type, thread, workspace,
              created, updated, created_ymd, created_ym, updated_ymd, v, source_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              path        = excluded.path,
              title       = excluded.title,
              type        = excluded.type,
              thread      = excluded.thread,
              workspace   = excluded.workspace,
              created     = excluded.created,
              updated     = excluded.updated,
              created_ymd = excluded.created_ymd,
              created_ym  = excluded.created_ym,
              updated_ymd = excluded.updated_ymd,
              v           = excluded.v,
              source_id   = excluded.source_id`,
        )
        .run(
          note.id,
          rowid,
          note.path,
          note.title,
          note.type,
          note.thread ?? null,
          note.workspace,
          note.created,
          note.updated ?? null,
          createdYmd,
          createdYm,
          updatedYmd,
          note.v,
          note.source_id ?? null,
        );

      // FTS5 contentless: delete + insert at the same rowid.
      this.#db.prepare(`DELETE FROM notes_fts WHERE rowid = ?`).run(rowid);
      this.#db
        .prepare(`INSERT INTO notes_fts(rowid, title, tags_text, body) VALUES (?, ?, ?, ?)`)
        .run(rowid, note.title, tagsText, note.body);

      // Tags + aliases — full rewrite (cheaper than diff for the v1 scale).
      this.#db.prepare(`DELETE FROM notes_tags WHERE note_id = ?`).run(note.id);
      const insertTag = this.#db.prepare(`INSERT INTO notes_tags(note_id, tag) VALUES (?, ?)`);
      for (const tag of note.tags) {
        insertTag.run(note.id, tag);
      }

      this.#db.prepare(`DELETE FROM notes_aliases WHERE note_id = ?`).run(note.id);
      if (note.aliases && note.aliases.length > 0) {
        const insertAlias = this.#db.prepare(
          `INSERT INTO notes_aliases(note_id, alias) VALUES (?, ?)`,
        );
        for (const alias of note.aliases) {
          insertAlias.run(note.id, alias);
        }
      }
    });
  }

  upsertSource(source: IndexableSource): void {
    this.#db
      .prepare(
        `INSERT INTO sources_meta(
            id, path, of, created, source, model, workspace, v
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            path      = excluded.path,
            of        = excluded.of,
            created   = excluded.created,
            source    = excluded.source,
            model     = excluded.model,
            workspace = excluded.workspace,
            v         = excluded.v`,
      )
      .run(
        source.id,
        source.path,
        source.of ?? null,
        source.created,
        source.source ?? null,
        source.model ?? null,
        source.workspace,
        source.v,
      );
  }

  delete(id: string): void {
    this.#db.transaction(() => {
      const existing = this.#db
        .prepare(`SELECT rowid FROM notes_meta WHERE id = ?`)
        .get<{ rowid: number }>(id);
      if (existing) {
        this.#db.prepare(`DELETE FROM notes_fts WHERE rowid = ?`).run(existing.rowid);
      }
      // notes_tags + notes_aliases cascade via FK.
      this.#db.prepare(`DELETE FROM notes_meta WHERE id = ?`).run(id);
    });
  }

  vacuum(): void {
    this.#db.exec(`VACUUM`);
  }
}

function ymd(iso: string): string {
  // ISO-8601 'YYYY-MM-DDTHH:MM:SSZ' — first 10 chars are YYYY-MM-DD.
  return iso.slice(0, 10);
}

function ym(iso: string): string {
  return iso.slice(0, 7);
}

function nextRowid(db: SqliteAdapter): number {
  const row = db.prepare(`SELECT COALESCE(MAX(rowid), 0) + 1 AS next FROM notes_meta`).get<{
    next: number;
  }>();
  return row?.next ?? 1;
}
