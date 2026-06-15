// SearchEngine — lexical FTS5 search + faceted aggregation.
// Cursor pagination uses an opaque base64-encoded JSON of (created, id) for
// stable ordering; this means the wire shape is just `string`.

import type {
  GroupedPage,
  ListGroupBy,
  ListInput,
  ListRecentInput,
  ListTagsInput,
  NoteSummary,
  SearchFilter,
  SearchInput,
  SearchPage,
  TagSummary,
} from '../schema/index.ts';
import type { SqliteAdapter } from './adapter.ts';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const GROUP_SAMPLE_SIZE = 5;

interface NoteMetaRow {
  id: string;
  path: string;
  title: string;
  type: string;
  thread: string | null;
  created: string;
  updated: string | null;
}

interface NoteMetaWithSnippetRow extends NoteMetaRow {
  snippet?: string | null;
}

interface CountRow {
  count: number;
}

interface BucketRow {
  key: string;
  count: number;
}

interface TagRow {
  tag: string;
  count: number;
}

export class SearchEngine {
  readonly #db: SqliteAdapter;

  constructor(adapter: SqliteAdapter) {
    this.#db = adapter;
  }

  search(input: SearchInput): SearchPage {
    const limit = clampLimit(input.limit);
    const cursor = decodeCursor(input.cursor);
    const matchExpr = sanitizeFtsQuery(input.q);

    const filterClauses: string[] = ['notes_meta.workspace = ?'];
    const params: unknown[] = [input.workspace];

    if (matchExpr) {
      filterClauses.push('notes_fts MATCH ?');
      params.push(matchExpr);
    }
    applyFilter(input.filter, filterClauses, params);
    applyCursor(cursor, filterClauses, params);

    const joinFts = matchExpr ? 'JOIN notes_fts ON notes_fts.rowid = notes_meta.rowid' : '';
    const snippetSelect = matchExpr
      ? "snippet(notes_fts, 2, '<mark>', '</mark>', '…', 16) AS snippet"
      : 'NULL AS snippet';
    const orderBy = matchExpr ? 'bm25(notes_fts)' : 'notes_meta.created DESC';

    const sql = `
      SELECT
        notes_meta.id, notes_meta.path, notes_meta.title, notes_meta.type,
        notes_meta.thread, notes_meta.created, notes_meta.updated,
        ${snippetSelect}
      FROM notes_meta
      ${joinFts}
      WHERE ${filterClauses.join(' AND ')}
      ORDER BY ${orderBy}, notes_meta.id ASC
      LIMIT ?
    `;

    const rows = this.#db.prepare(sql).all<NoteMetaWithSnippetRow>(...params, limit + 1);

    const trimmed = rows.slice(0, limit);
    const results = trimmed.map((row) => this.#hydrateSummary(row));
    const nextCursor =
      rows.length > limit
        ? encodeCursor({
            created: trimmed[trimmed.length - 1]?.created ?? '',
            id: trimmed[trimmed.length - 1]?.id ?? '',
          })
        : undefined;

    const result: SearchPage = { results };
    if (nextCursor !== undefined) result.next_cursor = nextCursor;
    return result;
  }

  list(input: ListInput): GroupedPage {
    if (!input.group_by) {
      // No group_by → return a single bucket of recent results.
      const recent = this.listRecent({
        workspace: input.workspace,
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
      });
      return {
        groups: [
          {
            key: 'all',
            count: recent.length,
            sample: recent,
          },
        ],
      };
    }

    const filterClauses: string[] = ['notes_meta.workspace = ?'];
    const params: unknown[] = [input.workspace];
    applyFilter(input.filter, filterClauses, params);

    const groupBy = input.group_by;
    const { keyExpr, joinClause } = groupByPlan(groupBy);
    const sql = `
      SELECT ${keyExpr} AS key, COUNT(*) AS count
      FROM notes_meta
      ${joinClause}
      WHERE ${filterClauses.join(' AND ')}
      GROUP BY key
      ORDER BY count DESC, key ASC
      LIMIT ?
    `;
    const limit = clampLimit(input.limit);
    const buckets = this.#db.prepare(sql).all<BucketRow>(...params, limit);

    const groups = buckets.map((bucket) => ({
      key: bucket.key,
      count: bucket.count,
      sample: this.#sampleForBucket(groupBy, bucket.key, input.workspace),
    }));

    return { groups };
  }

  listTags(input: ListTagsInput): TagSummary[] {
    const params: unknown[] = [];
    let where = '';
    if (input.prefix !== undefined && input.prefix !== '') {
      where = 'WHERE tag LIKE ?';
      params.push(`${input.prefix}%`);
    }
    const sql = `
      SELECT tag, COUNT(*) AS count
      FROM notes_tags
      ${where}
      GROUP BY tag
      ORDER BY count DESC, tag ASC
    `;
    return this.#db.prepare(sql).all<TagRow>(...params);
  }

  listRecent(input: ListRecentInput): NoteSummary[] {
    const limit = clampLimit(input.limit);
    const filterClauses: string[] = ['workspace = ?'];
    const params: unknown[] = [input.workspace];

    if (input.since !== undefined) {
      filterClauses.push('created >= ?');
      params.push(input.since);
    }

    const sql = `
      SELECT id, path, title, type, thread, created, updated
      FROM notes_meta
      WHERE ${filterClauses.join(' AND ')}
      ORDER BY created DESC, id ASC
      LIMIT ?
    `;
    const rows = this.#db.prepare(sql).all<NoteMetaRow>(...params, limit);
    return rows.map((row) => this.#hydrateSummary(row));
  }

  #hydrateSummary(row: NoteMetaWithSnippetRow): NoteSummary {
    const tags = this.#db
      .prepare(`SELECT tag FROM notes_tags WHERE note_id = ? ORDER BY tag ASC`)
      .all<{ tag: string }>(row.id)
      .map((t) => t.tag);
    const summary: NoteSummary = {
      id: row.id,
      path: row.path,
      title: row.title,
      tags,
      type: row.type,
      created: row.created,
    };
    if (row.thread !== null) summary.thread = row.thread;
    if (row.updated !== null) summary.updated = row.updated;
    if (row.snippet !== null && row.snippet !== undefined) summary.snippet = row.snippet;
    return summary;
  }

  #sampleForBucket(groupBy: ListGroupBy, key: string, workspace: string): NoteSummary[] {
    const { whereExpr, joinClause } = sampleClauseForGroupBy(groupBy);
    const sql = `
      SELECT notes_meta.id, notes_meta.path, notes_meta.title, notes_meta.type,
             notes_meta.thread, notes_meta.created, notes_meta.updated
      FROM notes_meta
      ${joinClause}
      WHERE notes_meta.workspace = ? AND ${whereExpr}
      ORDER BY notes_meta.created DESC, notes_meta.id ASC
      LIMIT ?
    `;
    const rows = this.#db.prepare(sql).all<NoteMetaRow>(workspace, key, GROUP_SAMPLE_SIZE);
    return rows.map((row) => this.#hydrateSummary(row));
  }

  /** Total count helper — useful for tests, not a part of the spec surface. */
  countNotes(workspace: string): number {
    const row = this.#db
      .prepare(`SELECT COUNT(*) AS count FROM notes_meta WHERE workspace = ?`)
      .get<CountRow>(workspace);
    return row?.count ?? 0;
  }
}

// FTS5 query sanitization: quote each whitespace-separated term so user
// input never produces a parser bomb (op-sqlite + bun:sqlite are equally
// permissive, but FTS5 will reject syntactic garbage outright).
function sanitizeFtsQuery(q: string): string {
  const trimmed = q.trim();
  if (trimmed === '') return '';
  return trimmed
    .split(/\s+/)
    .filter((tok) => tok !== '')
    .map((tok) => `"${tok.replace(/"/g, '""')}"`)
    .join(' ');
}

function applyFilter(filter: SearchFilter | undefined, clauses: string[], params: unknown[]): void {
  if (!filter) return;

  if (filter.tags_any && filter.tags_any.length > 0) {
    const placeholders = filter.tags_any.map(() => '?').join(', ');
    clauses.push(
      `notes_meta.id IN (SELECT note_id FROM notes_tags WHERE tag IN (${placeholders}))`,
    );
    params.push(...filter.tags_any);
  }

  if (filter.tags_all && filter.tags_all.length > 0) {
    const placeholders = filter.tags_all.map(() => '?').join(', ');
    clauses.push(
      `notes_meta.id IN (
        SELECT note_id FROM notes_tags
        WHERE tag IN (${placeholders})
        GROUP BY note_id
        HAVING COUNT(DISTINCT tag) = ?
      )`,
    );
    params.push(...filter.tags_all, filter.tags_all.length);
  }

  if (filter.type && filter.type.length > 0) {
    const placeholders = filter.type.map(() => '?').join(', ');
    clauses.push(`notes_meta.type IN (${placeholders})`);
    params.push(...filter.type);
  }

  if (filter.thread !== undefined) {
    clauses.push(`notes_meta.thread = ?`);
    params.push(filter.thread);
  }

  if (filter.created_after !== undefined) {
    clauses.push(`notes_meta.created >= ?`);
    params.push(filter.created_after);
  }

  if (filter.created_before !== undefined) {
    clauses.push(`notes_meta.created <= ?`);
    params.push(filter.created_before);
  }
}

interface DecodedCursor {
  created: string;
  id: string;
}

function decodeCursor(cursor: string | undefined): DecodedCursor | null {
  if (!cursor) return null;
  try {
    const json = atob(cursor);
    const parsed = JSON.parse(json) as DecodedCursor;
    if (typeof parsed.created !== 'string' || typeof parsed.id !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function encodeCursor(input: DecodedCursor): string {
  return btoa(JSON.stringify(input));
}

function applyCursor(cursor: DecodedCursor | null, clauses: string[], params: unknown[]): void {
  if (!cursor) return;
  // Tuple comparison for stable pagination.
  clauses.push(`(notes_meta.created, notes_meta.id) < (?, ?)`);
  params.push(cursor.created, cursor.id);
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (limit < 1) return DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) return MAX_LIMIT;
  return Math.floor(limit);
}

function groupByPlan(groupBy: ListGroupBy): { keyExpr: string; joinClause: string } {
  switch (groupBy) {
    case 'tag':
      return {
        keyExpr: 'notes_tags.tag',
        joinClause: 'JOIN notes_tags ON notes_tags.note_id = notes_meta.id',
      };
    case 'type':
      return { keyExpr: 'notes_meta.type', joinClause: '' };
    case 'thread':
      return { keyExpr: "COALESCE(notes_meta.thread, '')", joinClause: '' };
    case 'day':
      return { keyExpr: 'notes_meta.created_ymd', joinClause: '' };
    case 'week':
      // ISO-8601 week derived from created_ymd via strftime('%Y-W%W', ...).
      return {
        keyExpr: "strftime('%Y-W%W', notes_meta.created_ymd)",
        joinClause: '',
      };
    case 'month':
      return { keyExpr: 'notes_meta.created_ym', joinClause: '' };
  }
}

function sampleClauseForGroupBy(groupBy: ListGroupBy): {
  whereExpr: string;
  joinClause: string;
} {
  switch (groupBy) {
    case 'tag':
      return {
        whereExpr: 'notes_tags.tag = ?',
        joinClause: 'JOIN notes_tags ON notes_tags.note_id = notes_meta.id',
      };
    case 'type':
      return { whereExpr: 'notes_meta.type = ?', joinClause: '' };
    case 'thread':
      return {
        whereExpr: "COALESCE(notes_meta.thread, '') = ?",
        joinClause: '',
      };
    case 'day':
      return { whereExpr: 'notes_meta.created_ymd = ?', joinClause: '' };
    case 'week':
      return {
        whereExpr: "strftime('%Y-W%W', notes_meta.created_ymd) = ?",
        joinClause: '',
      };
    case 'month':
      return { whereExpr: 'notes_meta.created_ym = ?', joinClause: '' };
  }
}
