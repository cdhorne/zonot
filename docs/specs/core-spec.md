# Core spec — convention envelope, FTS schema, write client, conformance harness

> **Companion to [ADR-0008](../adr/0008-search.md) / [ADR-0011](../adr/0011-components-and-core.md) / [ADR-0022](../adr/0022-reuse-and-idioms.md).** This document is
> the implementation contract for `packages/core` (built first per [ADR-0024](../adr/0024-project-scaffold.md)). It is **hand-authored**.
> When an ADR and this spec disagree, the ADR wins and this file should be
> fixed. Phase 0 agent tasks (a)–(g) in `ROADMAP.md` reference the sections here.

## 0. Scope

This spec pins the artifacts Phase 0 must produce concretely enough to be implemented and reviewed
by separate agents. It covers:

1. The **convention envelope** — frontmatter key order, YAML quoting, slug derivation, layout.
2. The **FTS5 schema** — tables, columns, indices, tokenizer, the `SqliteAdapter` and
   `SearchEngine` interfaces.
3. The **`WriteClient` interface** — operation signatures, the SHA-conditional error contract,
   idempotency rules, the provenance-trailer format.
4. The **conformance harness** — fixture format, three test layers, coverage matrix, CI gate.

It does **not** cover: enriched body shapes (model-dependent), backend-specific commit details
(GitHub REST vs. isomorphic-git nuances), the MCP / HTTP transports (ADR-0021), or the v1.2 edge
search materialization (ADR-0009). Each lands in its own phase.

## 1. The convention envelope (`v: 1`)

### 1.1 Frontmatter key order

The core emits keys in **exactly** this order. Conformance fixtures lock the byte order; readers
(Obsidian, Dataview, downstream tools) MUST NOT rely on it but get a stable hash if they do.

```
MUST     id, v, created, tags
SHOULD   updated, type
COULD    aliases, thread, title, workspace, source
UNKNOWN  passed through verbatim, in input-order, after COULD
```

For source nodes (`type: context`), the order is:

```
MUST     id, v, type, of, created
SHOULD   source, model, updated
COULD    workspace
UNKNOWN  passed through, in input-order, after COULD
```

### 1.2 YAML serialization rules

- **Datetimes** (`created`, `updated`): ISO-8601 UTC, `…Z` suffix, **unquoted**.
- **ULIDs** (`id`, `source`, `of`): 26-char Crockford base32, **unquoted**.
- **Strings**: single-quoted only when the value contains a YAML special character (`: # & * ! | > ' " % @ \``), starts with `[` or `{`, parses as a number/bool/null, or contains a leading/trailing whitespace.
- **Lists** (`tags`, `aliases`): YAML **block sequence** (one item per line, `-` prefix), never inline `[…]`.
- **Strings inside lists** follow the same quoting rules as scalar strings.
- **Booleans/numbers**: literal `true`/`false`/integer/float; never quoted.
- **Null**: omit the key entirely; never emit `null` or empty string.
- **Trailing newline** after the closing `---` separator.

### 1.3 Slug derivation

```ts
function slugify(input: { title?: string; id: string }): string {
  if (!input.title || input.title.trim() === '') return input.id;

  const nfc = input.title.normalize('NFC');
  const ascii = nfc
    .replace(/\p{Diacritic}/gu, '')      // strip combining marks
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')  // non-letter/number/space/hyphen → space
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (ascii === '') return input.id;
  return truncateAtWordBoundary(ascii, 60);
}
```

`truncateAtWordBoundary(s, n)` trims at the last `-` at or before position `n`; if none, hard-cut at
`n`. Reserved filesystem chars (`/ \ : * ? " < > |`) are already removed by the non-letter pass.

### 1.4 Layout

```
notes/YYYY/MM/<id>-<slug>.md       (where YYYY/MM come from `created`)
sources/YYYY/MM/<id>.md            (slug omitted; sources are addressed by id)
```

The `created` timestamp drives the path; once written, the path is immutable for the life of the
note (renames are out of scope for v1 — ADR-0026).

### 1.5 Tag normalization

```ts
function normalizeTags(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const t = raw
      .normalize('NFC')
      .toLowerCase()
      .trim()
      .replace(/[_\s]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (t === '' || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
```

### 1.6 Body splitter

The first top-level `---` line on its own splits the body into `body_compiled` (above) and
`body_timeline` (below). "Top-level" means not inside a fenced code block (` ``` ` or `~~~`).
No divider → all-compiled, empty timeline. Divider at start → empty compiled, all-timeline.
Multiple top-level dividers → only the first splits; the rest stay in `body_timeline` verbatim.

## 2. FTS5 schema (`SqliteAdapter` + `SearchEngine`)

### 2.1 DDL

```sql
-- Zonot FTS5 schema — schema_version = 1. Per-workspace database.

CREATE TABLE zonot_meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
) WITHOUT ROWID;
-- seed: ('schema_version', '1'), ('convention_version', '1'), ('built_at', '<iso8601>')

CREATE TABLE notes_meta (
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
);

CREATE INDEX notes_meta_type_created      ON notes_meta(type, created DESC);
CREATE INDEX notes_meta_thread_created    ON notes_meta(thread, created DESC) WHERE thread IS NOT NULL;
CREATE INDEX notes_meta_workspace_created ON notes_meta(workspace, created DESC);
CREATE INDEX notes_meta_created_ym        ON notes_meta(created_ym);
CREATE INDEX notes_meta_created_ymd       ON notes_meta(created_ymd);

CREATE TABLE notes_tags (
  note_id TEXT NOT NULL REFERENCES notes_meta(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (note_id, tag)
) WITHOUT ROWID;
CREATE INDEX notes_tags_tag ON notes_tags(tag);

CREATE TABLE notes_aliases (
  note_id TEXT NOT NULL REFERENCES notes_meta(id) ON DELETE CASCADE,
  alias   TEXT NOT NULL,
  PRIMARY KEY (note_id, alias)
) WITHOUT ROWID;
CREATE INDEX notes_aliases_alias ON notes_aliases(alias);

CREATE VIRTUAL TABLE notes_fts USING fts5(
  title,
  tags_text,
  body,
  content='',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE sources_meta (
  id        TEXT PRIMARY KEY,
  path      TEXT NOT NULL,
  of        TEXT,
  created   TEXT NOT NULL,
  source    TEXT,
  model     TEXT,
  workspace TEXT NOT NULL,
  v         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX sources_meta_of ON sources_meta(of) WHERE of IS NOT NULL;
```

`notes_fts` is contentless (`content=''`); the indexer writes to it explicitly using `(rowid, title,
tags_text, body)` tuples. `tags_text` is a space-joined denormalized form of normalized tags, used
only for FTS MATCH; structured tag queries use `notes_tags`.

### 2.2 Driver injection

```ts
export interface SqliteAdapter {
  exec(sql: string): void;
  prepare<TParams extends unknown[], TRow>(sql: string): SqliteStatement<TParams, TRow>;
  transaction<T>(fn: () => T): T;
  close(): void;
}

export interface SqliteStatement<TParams extends unknown[], TRow> {
  run(...params: TParams): { changes: number; lastInsertRowid: number };
  get(...params: TParams): TRow | undefined;
  all(...params: TParams): TRow[];
  iterate(...params: TParams): IterableIterator<TRow>;
}
```

Implementations: `BunSqliteAdapter` (`bun:sqlite`), `OpSqliteAdapter` (`op-sqlite`),
`DoSqliteAdapter` (Cloudflare Durable Object SQLite, v1.2).

### 2.3 `SearchEngine`

```ts
export interface SearchEngine {
  search(input: SearchInput): Promise<SearchPage>;
  list(input: ListInput): Promise<GroupedPage>;
  listTags(input: ListTagsInput): Promise<TagSummary[]>;
  listRecent(input: ListRecentInput): Promise<NoteSummary[]>;
}

export interface SearchInput {
  workspace: string;
  q: string;
  filter?: SearchFilter;
  cursor?: string;
  limit?: number;       // default 20, max 100
}

export interface ListInput {
  workspace: string;
  group_by?: 'tag' | 'type' | 'thread' | 'day' | 'week' | 'month';
  filter?: SearchFilter;
  cursor?: string;
  limit?: number;
}

export interface ListTagsInput {
  workspace: string;
  prefix?: string;
}

export interface ListRecentInput {
  workspace: string;
  since?: string;        // ISO-8601
  limit?: number;
}

export interface SearchFilter {
  tags_any?: string[];
  tags_all?: string[];
  type?: string[];
  thread?: string;
  created_after?: string;
  created_before?: string;
}

export interface SearchPage {
  results: NoteSummary[];
  next_cursor?: string;
  total_estimate?: number;
}

export interface GroupedPage {
  groups: GroupBucket[];
  next_cursor?: string;
}

export interface GroupBucket {
  key: string;
  count: number;
  sample: NoteSummary[];
}

export interface NoteSummary {
  id: string;
  path: string;
  title: string;
  tags: string[];
  type: string;
  thread?: string;
  created: string;
  updated?: string;
  snippet?: string;
}

export interface TagSummary {
  tag: string;
  count: number;
}
```

### 2.4 `IndexWriter`

```ts
export interface IndexWriter {
  upsertNote(note: NoteRecord): void;
  upsertSource(source: SourceRecord): void;
  delete(id: string): void;
  rebuild(opts?: { workspace?: string }): RebuildStats;
  vacuum(): void;
}

export interface RebuildStats {
  notes: number;
  sources: number;
  ms: number;
  warnings: string[];
}
```

Rebuild is always available as the recovery path; the canonical truth is the files in the repo
(ADR-0001 / CLAUDE.md non-negotiable).

## 3. `WriteClient` interface

### 3.1 The interface

```ts
export interface WriteClient {
  init(input: InitInput): Promise<InitResult>;
  capture(input: CaptureInput): Promise<WriteResult>;
  append(input: AppendInput): Promise<WriteResult>;
  correct(input: CorrectInput): Promise<WriteResult>;
  undo(input: UndoInput): Promise<WriteResult>;
  delete(input: DeleteInput): Promise<WriteResult>;
  readNote(input: ReadInput): Promise<NoteRecord>;
  head(input: HeadInput): Promise<HeadResult | null>;
}
```

### 3.2 Input/output shapes

```ts
export interface InitInput {
  workspace: string;
  conventionVersion: 1;
}

export interface InitResult {
  commit_sha: string;
  paths: string[];     // e.g. ['notes/.gitkeep', 'sources/.gitkeep', 'zonot.json']
}

export interface CaptureInput {
  workspace: string;
  output: CaptureOutput;
  raw?: string;        // verbatim original; persisted to sources/ when distinct from output.body
  thread?: string;
  idempotency_key?: string;
}

export interface CaptureOutput {
  title?: string;
  tags?: string[];
  type?: string;       // default 'note'
  body: string;        // markdown; ADR-0005 compiled/timeline shape
}

export interface AppendInput {
  workspace: string;
  id: string;
  block: string;       // dated block to append below the divider
  base_sha: string;
  idempotency_key?: string;
}

export interface CorrectInput {
  workspace: string;
  id: string;
  output: CaptureOutput; // replaces compiled body; timeline preserved
  base_sha: string;
  idempotency_key?: string;
}

export interface UndoInput {
  workspace: string;
  capture_id: string;
  reason?: string;
}

export interface DeleteInput {
  workspace: string;
  id: string;
  reason?: string;
}

export interface ReadInput {
  workspace: string;
  id: string;
  include_source?: boolean;
}

export interface HeadInput {
  workspace: string;
  id: string;
}

export interface HeadResult {
  sha: string;
  path: string;
}

export interface WriteResult {
  id: string;
  path: string;
  source_path?: string;
  commit_sha: string;
  url?: string;        // GitHub URL (edge backend only)
  applied_tags: string[];
  capture_id: string;  // ULID for the write event; equals provenance trailer Capture-Id
}

export interface NoteRecord {
  id: string;
  path: string;
  frontmatter: Frontmatter;
  body_compiled: string;
  body_timeline: string;
  raw_body: string;
  sha: string;
  source?: SourceRecord;
}

export interface SourceRecord {
  id: string;
  path: string;
  frontmatter: SourceFrontmatter;
  body: string;
  sha: string;
}

export interface Frontmatter {
  id: string;
  v: 1;
  created: string;
  tags: string[];
  updated?: string;
  type?: string;
  aliases?: string[];
  thread?: string;
  title?: string;
  workspace?: string;
  source?: string;
  [k: string]: unknown;   // tolerant pass-through (ADR-0005)
}

export interface SourceFrontmatter {
  id: string;
  v: 1;
  type: 'context';
  of?: string;
  created: string;
  source?: string;
  model?: string;
  updated?: string;
  workspace?: string;
  [k: string]: unknown;
}
```

### 3.3 Error contract

```ts
export class SHAConflictError extends Error {
  readonly name = 'SHAConflictError';
  constructor(
    public readonly path: string,
    public readonly sha_expected: string,
    public readonly sha_actual: string | null, // null when the path was deleted
  ) { super(`SHA conflict at ${path}: expected ${sha_expected}, got ${sha_actual ?? 'deleted'}`); }
}

export class IdempotencyReplayError extends Error {
  readonly name = 'IdempotencyReplayError';
  constructor(
    public readonly key: string,
    public readonly cached: WriteResult,
    public readonly attempted_body_hash: string,
  ) { super(`Idempotency key ${key} replayed with different body`); }
}

export class WorkspaceNotInitializedError extends Error {
  readonly name = 'WorkspaceNotInitializedError';
}
```

Transport mapping (Worker, ADR-0021):

| Core error                    | HTTP status | RFC 9457 `type`                            |
|-------------------------------|------------|--------------------------------------------|
| `SHAConflictError`            | `412`      | `https://zonot.app/problems/sha-conflict`  |
| `IdempotencyReplayError`      | `422`      | `https://zonot.app/problems/idempotency-replay` |
| `WorkspaceNotInitializedError`| `409`      | `https://zonot.app/problems/uninitialized` |

### 3.4 Idempotency

- Caller-supplied `idempotency_key` is hashed (`sha256`) together with the workspace and the
  canonical request body to a key `(workspace, idempotency_key)`.
- The first successful write stores `WriteResult + body_hash` in the operator's idempotency cache
  (Worker: KV with 24h TTL; CLI/app: a sqlite table `idempotency_cache(key, body_hash, result_json,
  expires_at)`).
- Replay with the **same** body within 24h returns the cached result. Replay with a **different**
  body raises `IdempotencyReplayError`.
- If `idempotency_key` is absent, the ULID `id` itself serves as the de-facto key (a re-issue of the
  same id is a replay).

### 3.5 Provenance trailers

The core builds the commit message; the backend writes it. Format:

```
<subject line>

<optional body paragraph>

Source: <capture origin string, e.g. "mcp:claude" or "cli:zonot@0.1.0">
Capture-Id: <ULID of this write event>
[Edit-Of: <id of the note being corrected>]
[Undo-Of: <Capture-Id of the write being undone>]
[Delete-Of: <id of the note being deleted>]
[Model: <model identifier, e.g. "claude-opus-4-7" or "none">]
```

Trailer rules:
- One trailer per line, RFC 5322 style (`Key: value`).
- `Source` and `Capture-Id` always present.
- `Edit-Of` on `correct`; `Undo-Of` on `undo`; `Delete-Of` on `delete`.
- `Model` set only when an enrichment model touched the body (Tier 1 or Tier 2); omitted for
  Tier 0 raw captures.

## 4. Conformance harness

### 4.1 Fixture file format

```json
{
  "name": "slug-empty-title-falls-back-to-id",
  "input": {
    "workspace": "personal",
    "output": {
      "title": "",
      "tags": ["Foo Bar", "foo-bar"],
      "type": "note",
      "body": "first line\n\n---\n\n- **2026-06-14** | seed — kickoff"
    },
    "raw": null,
    "thread": null,
    "idempotency_key": null,
    "_now": "2026-06-14T12:00:00Z",
    "_id": "01HZZZA1B2C3D4E5F6G7H8J9K0"
  },
  "expected": {
    "id_recipe": "from_input._id",
    "slug": "01HZZZA1B2C3D4E5F6G7H8J9K0",
    "path": "notes/2026/06/01HZZZA1B2C3D4E5F6G7H8J9K0-01HZZZA1B2C3D4E5F6G7H8J9K0.md",
    "frontmatter_bytes": "---\nid: 01HZZZA1B2C3D4E5F6G7H8J9K0\nv: 1\ncreated: 2026-06-14T12:00:00Z\ntags:\n  - foo-bar\ntype: note\nworkspace: personal\n---\n",
    "body_split": {
      "compiled": "first line\n",
      "timeline": "- **2026-06-14** | seed — kickoff\n"
    }
  }
}
```

Fixtures live in `packages/core/test/conformance/fixtures/`. Each `.json` file is one fixture. The
`_now` and `_id` fields are test-time injections so the fixture is deterministic — production code
gets them from `Clock` and `IdGenerator` ports (which the test harness stubs).

### 4.2 The three layers

**Layer 1 — Pure-function fixtures.** For each fixture, assert:
- `slugify(input.output.title, _id) === expected.slug`
- `derivePath(_now, _id, expected.slug) === expected.path`
- `normalizeTags(input.output.tags) === <tags in expected.frontmatter_bytes>`
- `splitBody(input.output.body) === expected.body_split`

**Layer 2 — Serialization.** For each fixture, assert:
- `serializeFrontmatter(buildFrontmatter(input, _now, _id)) === expected.frontmatter_bytes`
- The full file bytes equal `expected.frontmatter_bytes + expected.body_split.compiled + "\n---\n\n" + expected.body_split.timeline` (or the no-divider variant for fixtures with empty timeline).

**Layer 3 — Cross-runtime.** The same fixture suite runs inside the RN JSI runtime via a harness in
`apps/mobile/__conformance__/`. The harness imports the same `packages/core` module, reads the
same fixture files (bundled at build time), and asserts the same byte equalities. CI runs both Bun
and the RN harness; both must pass.

### 4.3 Coverage matrix

| Area               | Fixtures                                                                                   |
|--------------------|--------------------------------------------------------------------------------------------|
| Slug — empty title | falls back to id                                                                           |
| Slug — unicode     | NFC normalization (combining vs. precomposed → same slug)                                  |
| Slug — long title  | truncation at last `-` ≤ 60 chars; hard-cut when no `-`                                    |
| Slug — reserved    | `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` stripped                                       |
| Slug — RTL         | Hebrew/Arabic input produces a deterministic slug (lowercase no-op; hyphenated)            |
| Slug — emoji       | emoji stripped (treated as non-letter)                                                     |
| Frontmatter order  | MUST → SHOULD → COULD → unknown; unknown keys preserve input-order at the tail             |
| YAML quoting       | ISO-8601 unquoted; ULID unquoted; `:` in string forces quoting; `#` forces quoting          |
| Tag norm           | `["Foo Bar","foo-bar"," FOO_BAR ","_x_y_"] → ["foo-bar","x-y"]`                            |
| Body splitter      | no divider; divider at start; divider mid-body; multiple top-level dividers; in fenced code |
| Layout             | `created: 2026-06-14T...Z` → `notes/2026/06/<id>-<slug>.md`                                |
| NFC equivalence    | combining-diacritic input vs. precomposed → identical slug + identical frontmatter bytes   |
| Source node        | sources frontmatter has `type: context` first after id/v; `of` populated; omitted updated   |

### 4.4 Out of scope (do NOT gate in conformance)

- Enriched body content beyond the splitter (model-dependent, non-deterministic).
- Cross-runtime SQLite FTS results (tokenizer version drift acceptable).
- Commit-trailer formatting (covered by ADR-0007 unit tests).
- GitHub REST vs. isomorphic-git commit shape (covered by write-backend unit tests).
- HTTP transport / RFC 9457 details (covered by `apps/worker` integration tests).

### 4.5 CI gate

```
On any PR touching packages/core/**:
  - bun test packages/core              # Layers 1 & 2
  - bun run conformance:rn              # Layer 3 (RN JSI harness)
  Both must be green to merge.
```

Failure mode: the test runner prints a unified byte-diff of `expected` vs. `actual` alongside the
producing function name and the fixture path, so the diff points directly at the regressed code.

## 5. Performance budgets

Per-function timing budgets — `serializeFrontmatter`, `parseFrontmatter`, `splitBody`, `slugify`,
`normalizeTags`, `IndexWriter.upsertNote`, `SearchEngine.search` / `list` — live in
[`perf-budgets.md`](perf-budgets.md) §2. The CI bench discipline (mitata + regression detection)
applies per-PR.

## 6. Open items (for Phase 0 to close)

- **Source-vs-note disambiguation in the `raw` field — RESOLVED (ADR-0034 rev 6).** A `sources/`
  node is written **iff** `raw !== output.body` after normalization, **OR** the capture surface
  produces a distinct artifact (audio, image, shared payload) that can't be inlined into the
  body. Lock with fixtures: (a) byte-identical raw + body → no source node; (b) distinct raw +
  body → source node written; (c) raw absent → no source node.
- **Empty-body capture.** Allowed (a title-only / tags-only capture)? Default: yes, with a single
  blank line as the body. Lock with a fixture.
- **`idempotency_cache` table** for the local-git backend: where does it live (a sidecar SQLite
  in `.zonot/` outside the repo)? Confirm before Phase 2.

These are flagged here so they get resolved in Phase 0 design, not by accident during coding.
