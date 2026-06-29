// The local mirror (mobile-spec §3.1) — the device's `notes` content store plus
// the core FTS index derived from it. This parallels the CLI exactly: there the
// git repo is the mirror and the FTS index is rebuilt from its files; here the
// `notes` table holds the full note bytes and the FTS index (notes_meta /
// notes_fts, owned by the core IndexWriter) is derived from them. Both are
// derivable/disposable; the truth is the user's repo (ADR-0001).
//
// Pure SqliteAdapter, so it's bun-testable and runs on op-sqlite on device.
// The read screen needs full note bytes (raw-markdown view, source pointer,
// backlinks) — the FTS index doesn't retain them, so the `notes` table does.

import { parseNoteFile } from '@zonot/core';
import { type IndexableNote, IndexWriter, SearchEngine, type SqliteAdapter } from '@zonot/core/fts';
import type {
  GroupedPage,
  ListInput,
  ListRecentInput,
  ListTagsInput,
  NoteSummary,
  SearchInput,
  SearchPage,
  TagSummary,
} from '@zonot/core/schema';

// One statement per entry — op-sqlite's exec runs only the first of a
// multi-statement string (see the outbox).
const NOTES_DDL = [
  `CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    provisional INTEGER NOT NULL DEFAULT 0, -- 1 until the Worker acks the real id
    path        TEXT NOT NULL,
    content     TEXT NOT NULL,              -- full note file (frontmatter + body)
    workspace   TEXT NOT NULL,
    created     TEXT NOT NULL,
    updated     TEXT
  )`,
];

export interface MirrorNote {
  id: string;
  path: string;
  /** Full note file bytes (frontmatter + compiled/timeline body). */
  content: string;
  workspace: string;
  created: string;
  updated?: string | undefined;
  /** True for an optimistic capture not yet acked under its real server id. */
  provisional?: boolean;
}

interface NotesRow {
  id: string;
  provisional: number;
  path: string;
  content: string;
  workspace: string;
  created: string;
  updated: string | null;
}

export class Mirror {
  readonly #db: SqliteAdapter;
  readonly #writer: IndexWriter;
  readonly #engine: SearchEngine;

  constructor(adapter: SqliteAdapter) {
    this.#db = adapter;
    this.#writer = new IndexWriter(adapter);
    this.#engine = new SearchEngine(adapter);
  }

  /** Create the FTS schema + the `notes` content table. Safe on every boot. */
  ensureSchema(): void {
    this.#writer.ensureSchema();
    for (const ddl of NOTES_DDL) this.#db.exec(ddl);
  }

  /** Upsert a full note and (re)derive its FTS row — one transaction. */
  put(note: MirrorNote): void {
    this.#db.transaction(() => {
      this.#db
        .prepare(
          `INSERT INTO notes(id, provisional, path, content, workspace, created, updated)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              provisional = excluded.provisional,
              path        = excluded.path,
              content     = excluded.content,
              workspace   = excluded.workspace,
              created     = excluded.created,
              updated     = excluded.updated`,
        )
        .run(
          note.id,
          note.provisional ? 1 : 0,
          note.path,
          note.content,
          note.workspace,
          note.created,
          note.updated ?? null,
        );
      this.#writer.upsertNote(indexableFromContent(note));
    });
  }

  /** Drop a note from both the content store and the FTS index. */
  remove(id: string): void {
    this.#db.transaction(() => {
      this.#db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
      this.#writer.delete(id);
    });
  }

  /** Full note bytes for the read view, or null if not mirrored locally. */
  getContent(id: string): string | null {
    return (
      this.#db.prepare(`SELECT content FROM notes WHERE id = ?`).get<{ content: string }>(id)
        ?.content ?? null
    );
  }

  getNote(id: string): MirrorNote | null {
    const row = this.#db.prepare(`SELECT * FROM notes WHERE id = ?`).get<NotesRow>(id);
    if (!row) return null;
    return {
      id: row.id,
      path: row.path,
      content: row.content,
      workspace: row.workspace,
      created: row.created,
      updated: row.updated ?? undefined,
      provisional: row.provisional === 1,
    };
  }

  // --- read surface (delegates to the core SearchEngine over the same db) ---

  search(input: SearchInput): SearchPage {
    return this.#engine.search(input);
  }
  list(input: ListInput): GroupedPage {
    return this.#engine.list(input);
  }
  listRecent(input: ListRecentInput): NoteSummary[] {
    return this.#engine.listRecent(input);
  }
  listTags(input: ListTagsInput): TagSummary[] {
    return this.#engine.listTags(input);
  }
}

/** Parse a note file into the core's IndexableNote (mirrors the CLI's indexAll). */
function indexableFromContent(note: MirrorNote): IndexableNote {
  const { frontmatter: fm, raw_body } = parseNoteFile(note.content, note.path);
  return {
    id: fm.id,
    path: note.path,
    title: fm.title ?? '',
    type: fm.type ?? 'note',
    thread: fm.thread,
    workspace: note.workspace,
    created: fm.created,
    updated: fm.updated,
    v: fm.v,
    source_id: fm.source,
    tags: fm.tags,
    aliases: fm.aliases,
    body: raw_body,
  };
}
