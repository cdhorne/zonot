// Per-workspace FTS5 schema (v1). Schema version tracked in
// zonot_meta('schema_version', ...) for forward migrations.

export const FTS_SCHEMA_VERSION = 1 as const;

export const DDL_STATEMENTS: ReadonlyArray<string> = [
  `CREATE TABLE IF NOT EXISTS zonot_meta (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL
  ) WITHOUT ROWID`,

  `CREATE TABLE IF NOT EXISTS notes_meta (
    id          TEXT PRIMARY KEY,
    rowid       INTEGER UNIQUE NOT NULL,
    path        TEXT NOT NULL,
    title       TEXT NOT NULL DEFAULT '',
    type        TEXT NOT NULL DEFAULT 'note',
    thread      TEXT,
    workspace   TEXT NOT NULL,
    created     TEXT NOT NULL,
    updated     TEXT,
    created_ymd TEXT NOT NULL,
    created_ym  TEXT NOT NULL,
    updated_ymd TEXT,
    v           INTEGER NOT NULL DEFAULT 1,
    source_id   TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS notes_meta_type_created
    ON notes_meta(type, created DESC)`,
  `CREATE INDEX IF NOT EXISTS notes_meta_thread_created
    ON notes_meta(thread, created DESC) WHERE thread IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS notes_meta_workspace_created
    ON notes_meta(workspace, created DESC)`,
  `CREATE INDEX IF NOT EXISTS notes_meta_created_ym ON notes_meta(created_ym)`,
  `CREATE INDEX IF NOT EXISTS notes_meta_created_ymd ON notes_meta(created_ymd)`,

  `CREATE TABLE IF NOT EXISTS notes_tags (
    note_id TEXT NOT NULL REFERENCES notes_meta(id) ON DELETE CASCADE,
    tag     TEXT NOT NULL,
    PRIMARY KEY (note_id, tag)
  ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS notes_tags_tag ON notes_tags(tag)`,

  `CREATE TABLE IF NOT EXISTS notes_aliases (
    note_id TEXT NOT NULL REFERENCES notes_meta(id) ON DELETE CASCADE,
    alias   TEXT NOT NULL,
    PRIMARY KEY (note_id, alias)
  ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS notes_aliases_alias ON notes_aliases(alias)`,

  // Contentful FTS5 (the index stores its own copy of the text). This is the
  // standard pattern: plain `DELETE FROM notes_fts WHERE rowid = ?` works, and
  // snippet()/highlight() can return real excerpts. The note body is duplicated
  // into the index, which is acceptable at v1 scale; the canonical truth is
  // still the user's repo, so the whole DB stays derivable/disposable (ADR-0001).
  `CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    tags_text,
    body,
    tokenize='unicode61 remove_diacritics 2'
  )`,

  `CREATE TABLE IF NOT EXISTS sources_meta (
    id        TEXT PRIMARY KEY,
    path      TEXT NOT NULL,
    of        TEXT,
    created   TEXT NOT NULL,
    source    TEXT,
    model     TEXT,
    workspace TEXT NOT NULL,
    v         INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE INDEX IF NOT EXISTS sources_meta_of
    ON sources_meta(of) WHERE of IS NOT NULL`,
];
