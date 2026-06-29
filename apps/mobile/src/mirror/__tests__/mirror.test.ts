import { beforeEach, describe, expect, test } from 'bun:test';
import { parseNoteFile } from '@zonot/core';
import type { CaptureInput } from '@zonot/core/schema';
// Reuse the core FTS bun:sqlite adapter (test-only deep import).
import { openBunAdapter } from '../../../../../packages/core/src/fts/__tests__/bun-adapter.ts';
import { assembleMirrorNote, prepareLocalCapture } from '../capture.ts';
import { Mirror } from '../mirror.ts';

const NOW = '2026-06-14T12:00:00.000Z';
const input: CaptureInput = {
  workspace: 'personal',
  output: { title: 'Buy milk', body: 'remember the milk', tags: ['Groceries'] },
};

// Valid 26-char Crockford ULIDs (deriveNotePath asserts the shape).
const ID = {
  n1: '01000000000000000000000001',
  prov: '01000000000000000000000002',
  real: '01000000000000000000000003',
};

/** Deterministic ULID minter so assertions are stable. */
function counter() {
  let n = 0;
  return () => `01${String(++n).padStart(24, '0')}`;
}

describe('Mirror', () => {
  let mirror: Mirror;

  beforeEach(() => {
    mirror = new Mirror(openBunAdapter());
    mirror.ensureSchema();
  });

  test('put indexes a note: searchable, listable, full bytes retrievable', () => {
    const { note } = assembleMirrorNote(input, {
      id: ID.n1,
      created: NOW,
      source: 'mobile',
      provisional: false,
    });
    mirror.put(note);

    expect(mirror.search({ workspace: 'personal', q: 'milk' }).results.map((r) => r.id)).toEqual([
      ID.n1,
    ]);
    expect(mirror.listRecent({ workspace: 'personal' }).map((r) => r.id)).toEqual([ID.n1]);
    // Full note bytes survive for the read view; tags were normalized in-core.
    const content = mirror.getContent(ID.n1);
    expect(content).not.toBeNull();
    expect(parseNoteFile(content ?? '', note.path).frontmatter.tags).toEqual(['groceries']);
    expect(mirror.getNote(ID.n1)?.provisional).toBe(false);
  });

  test('remove drops the note from both the content store and FTS', () => {
    const { note } = assembleMirrorNote(input, {
      id: ID.n1,
      created: NOW,
      source: 'mobile',
      provisional: false,
    });
    mirror.put(note);
    mirror.remove(ID.n1);
    expect(mirror.getContent(ID.n1)).toBeNull();
    expect(mirror.search({ workspace: 'personal', q: 'milk' }).results).toEqual([]);
  });

  test('reconcile = put(real) + remove(provisional): only the real note survives', () => {
    // Optimistic insert under a provisional id...
    const prov = assembleMirrorNote(input, {
      id: ID.prov,
      created: NOW,
      source: 'mobile',
      provisional: true,
    });
    mirror.put(prov.note);
    // ...then the Worker acks a real id; the sync layer rebuilds + swaps.
    const real = assembleMirrorNote(input, {
      id: ID.real,
      created: NOW,
      source: 'mobile',
      provisional: false,
    });
    mirror.put(real.note);
    mirror.remove(ID.prov);

    const hits = mirror.search({ workspace: 'personal', q: 'milk' }).results.map((r) => r.id);
    expect(hits).toEqual([ID.real]);
    expect(mirror.getNote(ID.prov)).toBeNull();
  });
});

describe('prepareLocalCapture', () => {
  test('mints a provisional note + an outbox payload with an idempotency key', () => {
    const local = prepareLocalCapture(input, NOW, { newId: counter() });
    expect(local.note.provisional).toBe(true);
    expect(local.note.id).toBe(local.provisionalId);
    expect(local.payload.idempotency_key).toBe(local.idempotencyKey);
    expect(local.appliedTags).toEqual(['groceries']);
    // The optimistic note carries the captured body.
    expect(local.note.content).toContain('remember the milk');
  });

  test('honors a caller-supplied idempotency key (idempotent re-save)', () => {
    const withKey: CaptureInput = { ...input, idempotency_key: 'fixed-key' };
    const local = prepareLocalCapture(withKey, NOW, { newId: counter() });
    expect(local.idempotencyKey).toBe('fixed-key');
    expect(local.payload.idempotency_key).toBe('fixed-key');
  });
});
