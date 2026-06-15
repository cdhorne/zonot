import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { SqliteAdapter } from '../adapter.ts';
import { IndexWriter } from '../index-writer.ts';
import { SearchEngine } from '../search-engine.ts';
import { openBunAdapter } from './bun-adapter.ts';

const WORKSPACE = 'personal';

let db: SqliteAdapter;
let writer: IndexWriter;
let engine: SearchEngine;

function ulid(suffix: string): string {
  // Test-only synthetic ULIDs — valid Crockford base32, ordered by suffix.
  return `01HZZZA${suffix.padEnd(19, '0')}`;
}

function seed(): void {
  writer.upsertNote({
    id: ulid('AAA'),
    path: 'notes/2026/06/01.md',
    title: 'Launch plan',
    type: 'note',
    thread: 'q3-launch',
    workspace: WORKSPACE,
    created: '2026-06-10T10:00:00Z',
    v: 1,
    tags: ['design', 'priority'],
    body: 'A clear plan for the launch.',
  });
  writer.upsertNote({
    id: ulid('BBB'),
    path: 'notes/2026/06/02.md',
    title: 'Followup',
    type: 'todo',
    thread: 'q3-launch',
    workspace: WORKSPACE,
    created: '2026-06-11T10:00:00Z',
    v: 1,
    tags: ['design'],
    body: 'Followup tasks for the design system.',
  });
  writer.upsertNote({
    id: ulid('CCC'),
    path: 'notes/2026/05/03.md',
    title: 'Old note',
    type: 'note',
    workspace: WORKSPACE,
    created: '2026-05-20T10:00:00Z',
    v: 1,
    tags: ['archive'],
    body: 'An older note about an older thing.',
  });
}

beforeEach(() => {
  db = openBunAdapter();
  writer = new IndexWriter(db);
  writer.ensureSchema();
  engine = new SearchEngine(db);
  seed();
});

afterEach(() => {
  db.close();
});

describe('IndexWriter', () => {
  test('ensureSchema is idempotent and records the schema version', () => {
    writer.ensureSchema();
    writer.ensureSchema();
    expect(writer.schemaVersion()).toBe(1);
  });

  test('upsertNote replaces a note on conflict', () => {
    writer.upsertNote({
      id: ulid('AAA'),
      path: 'notes/2026/06/01.md',
      title: 'Launch plan — revised',
      type: 'note',
      workspace: WORKSPACE,
      created: '2026-06-10T10:00:00Z',
      v: 1,
      tags: ['design'],
      body: 'Updated body.',
    });
    expect(engine.countNotes(WORKSPACE)).toBe(3);
    const results = engine.search({ workspace: WORKSPACE, q: 'revised' });
    expect(results.results.map((r) => r.id)).toContain(ulid('AAA'));
  });

  test('delete removes the note and cascades tags', () => {
    writer.delete(ulid('AAA'));
    expect(engine.countNotes(WORKSPACE)).toBe(2);
  });
});

describe('SearchEngine.search', () => {
  test('finds a note by body term', () => {
    const result = engine.search({ workspace: WORKSPACE, q: 'launch' });
    const ids = result.results.map((r) => r.id);
    expect(ids).toContain(ulid('AAA'));
  });

  test('returns a snippet when matching', () => {
    const result = engine.search({ workspace: WORKSPACE, q: 'design' });
    expect(result.results.length).toBeGreaterThan(0);
    const matched = result.results.find((r) => r.snippet !== undefined);
    expect(matched).toBeDefined();
  });

  test('returns recent-first when query is empty', () => {
    const result = engine.search({ workspace: WORKSPACE, q: '' });
    expect(result.results[0]?.id).toBe(ulid('BBB'));
  });

  test('honors workspace isolation', () => {
    const result = engine.search({ workspace: 'other', q: 'launch' });
    expect(result.results).toEqual([]);
  });

  test('applies tags_any filter', () => {
    const result = engine.search({
      workspace: WORKSPACE,
      q: '',
      filter: { tags_any: ['archive'] },
    });
    expect(result.results.map((r) => r.id)).toEqual([ulid('CCC')]);
  });

  test('applies type filter', () => {
    const result = engine.search({
      workspace: WORKSPACE,
      q: '',
      filter: { type: ['todo'] },
    });
    expect(result.results.map((r) => r.id)).toEqual([ulid('BBB')]);
  });

  test('cursor pagination is stable', () => {
    const page1 = engine.search({ workspace: WORKSPACE, q: '', limit: 1 });
    expect(page1.results).toHaveLength(1);
    expect(page1.next_cursor).toBeDefined();
    const page2 = engine.search({
      workspace: WORKSPACE,
      q: '',
      limit: 1,
      cursor: page1.next_cursor,
    });
    expect(page2.results).toHaveLength(1);
    expect(page2.results[0]?.id).not.toBe(page1.results[0]?.id);
  });
});

describe('SearchEngine.list', () => {
  test('group_by tag returns aggregate counts', () => {
    const result = engine.list({ workspace: WORKSPACE, group_by: 'tag' });
    const designBucket = result.groups.find((g) => g.key === 'design');
    expect(designBucket?.count).toBe(2);
  });

  test('group_by type returns aggregate counts', () => {
    const result = engine.list({ workspace: WORKSPACE, group_by: 'type' });
    const note = result.groups.find((g) => g.key === 'note');
    const todo = result.groups.find((g) => g.key === 'todo');
    expect(note?.count).toBe(2);
    expect(todo?.count).toBe(1);
  });

  test('group_by month returns YYYY-MM keys', () => {
    const result = engine.list({ workspace: WORKSPACE, group_by: 'month' });
    expect(result.groups.map((g) => g.key).sort()).toEqual(['2026-05', '2026-06']);
  });

  test('group_by includes a sample of recent notes per bucket', () => {
    const result = engine.list({ workspace: WORKSPACE, group_by: 'type' });
    const note = result.groups.find((g) => g.key === 'note');
    expect(note?.sample.length).toBeGreaterThan(0);
  });
});

describe('SearchEngine.listTags', () => {
  test('returns tag counts in descending order', () => {
    const tags = engine.listTags({ workspace: WORKSPACE });
    expect(tags[0]?.tag).toBe('design');
    expect(tags[0]?.count).toBe(2);
  });

  test('honors a prefix filter', () => {
    const tags = engine.listTags({ workspace: WORKSPACE, prefix: 'arc' });
    expect(tags.map((t) => t.tag)).toEqual(['archive']);
  });
});

describe('SearchEngine.listRecent', () => {
  test('returns notes in created-desc order', () => {
    const recent = engine.listRecent({ workspace: WORKSPACE });
    expect(recent.map((n) => n.id)).toEqual([ulid('BBB'), ulid('AAA'), ulid('CCC')]);
  });

  test('respects since filter', () => {
    const recent = engine.listRecent({
      workspace: WORKSPACE,
      since: '2026-06-01T00:00:00Z',
    });
    expect(recent.map((n) => n.id)).toEqual([ulid('BBB'), ulid('AAA')]);
  });
});
