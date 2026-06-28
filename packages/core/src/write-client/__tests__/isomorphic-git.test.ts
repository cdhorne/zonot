import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import nodeFs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NotFoundError,
  SHAConflictError,
  WorkspaceNotInitializedError,
} from '../../errors/index.ts';
import { parseCommitTrailers } from '../../provenance/index.ts';
import { IsomorphicGitBackend } from '../backends/isomorphic-git.ts';
import { ulidFactory } from './fake-github.ts';

const NOW = '2026-06-14T12:00:00Z';
let dir: string;

function makeBackend() {
  return new IsomorphicGitBackend({
    dir,
    fs: nodeFs,
    source: 'cli:zonot',
    author: { name: 'Test', email: 'test@localhost' },
    now: () => NOW,
    newId: ulidFactory(),
  });
}

/** The trailer block of the latest commit, for provenance assertions. */
async function headTrailers(): Promise<Record<string, string>> {
  const git = (await import('isomorphic-git')).default;
  const [entry] = await git.log({ fs: nodeFs, dir, depth: 1 });
  return parseCommitTrailers(entry?.commit.message ?? '');
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'zonot-git-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('IsomorphicGitBackend', () => {
  test('init creates the repo + scaffold, then is idempotent', async () => {
    const backend = makeBackend();
    const res = await backend.init({ workspace: 'personal', conventionVersion: 1 });
    expect(res.paths).toContain('zonot.json');
    expect(nodeFs.existsSync(join(dir, 'zonot.json'))).toBe(true);
    expect(nodeFs.existsSync(join(dir, '.git'))).toBe(true);

    const again = await backend.init({ workspace: 'personal', conventionVersion: 1 });
    expect(again.paths).toEqual(['zonot.json', 'notes/.gitkeep', 'sources/.gitkeep']);
  });

  test('capture writes a note, normalizes tags, commits provenance, reads back', async () => {
    const backend = makeBackend();
    await backend.init({ workspace: 'personal', conventionVersion: 1 });
    const res = await backend.capture({
      workspace: 'personal',
      output: { title: 'Kickoff', tags: ['Foo Bar', 'foo-bar'], body: 'first thought' },
    });
    expect(res.id).toBe(res.capture_id);
    expect(res.path).toMatch(/^notes\/2026\/06\/.*-kickoff\.md$/);
    expect(res.applied_tags).toEqual(['foo-bar']);
    expect(nodeFs.existsSync(join(dir, res.path))).toBe(true);

    const note = await backend.readNote({ workspace: 'personal', id: res.id });
    expect(note.frontmatter.title).toBe('Kickoff');
    expect(note.body_compiled).toBe('first thought\n');
    expect(note.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(await headTrailers()).toMatchObject({ Source: 'cli:zonot', 'Capture-Id': res.id });
  });

  test('capture with distinct raw writes a source node', async () => {
    const backend = makeBackend();
    await backend.init({ workspace: 'personal', conventionVersion: 1 });
    const res = await backend.capture({
      workspace: 'personal',
      output: { body: 'cleaned up' },
      raw: 'raw transcript',
    });
    expect(res.source_path).toBeDefined();
    const note = await backend.readNote({
      workspace: 'personal',
      id: res.id,
      include_source: true,
    });
    expect(note.source?.frontmatter.of).toBe(res.id);
    expect(note.source?.body).toBe('raw transcript\n');
  });

  test('append is SHA-conditional and stamps updated', async () => {
    const backend = makeBackend();
    await backend.init({ workspace: 'personal', conventionVersion: 1 });
    const cap = await backend.capture({ workspace: 'personal', output: { body: 'summary' } });
    const head = await backend.head({ workspace: 'personal', id: cap.id });

    await backend.append({
      workspace: 'personal',
      id: cap.id,
      block: '- **2026-06-14** | event',
      base_sha: head!.sha,
    });
    const note = await backend.readNote({ workspace: 'personal', id: cap.id });
    expect(note.body_timeline).toContain('event');
    expect(note.frontmatter.updated).toBe(NOW);

    await expect(
      backend.append({ workspace: 'personal', id: cap.id, block: '- x', base_sha: head!.sha }),
    ).rejects.toBeInstanceOf(SHAConflictError); // head.sha is now stale
  });

  test('correct preserves the timeline + tolerant frontmatter, emits Edit-Of', async () => {
    const backend = makeBackend();
    await backend.init({ workspace: 'personal', conventionVersion: 1 });
    const cap = await backend.capture({
      workspace: 'personal',
      output: { title: 'Draft', tags: ['a'], body: 'old' },
    });
    await backend.append({
      workspace: 'personal',
      id: cap.id,
      block: '- kept',
      base_sha: (await backend.head({ workspace: 'personal', id: cap.id }))!.sha,
    });

    await backend.correct({
      workspace: 'personal',
      id: cap.id,
      output: { title: 'Fixed', body: 'new compiled' }, // no tags/type → preserved
      base_sha: (await backend.head({ workspace: 'personal', id: cap.id }))!.sha,
    });
    const note = await backend.readNote({ workspace: 'personal', id: cap.id });
    expect(note.body_compiled.trim()).toBe('new compiled');
    expect(note.body_timeline).toContain('kept');
    expect(note.frontmatter.title).toBe('Fixed');
    expect(note.frontmatter.tags).toEqual(['a']); // preserved
    expect((await headTrailers())['Edit-Of']).toBe(cap.id);
  });

  test('delete removes note + source; readNote then 404s', async () => {
    const backend = makeBackend();
    await backend.init({ workspace: 'personal', conventionVersion: 1 });
    const cap = await backend.capture({
      workspace: 'personal',
      output: { body: 'doomed' },
      raw: 'raw doomed',
    });
    const del = await backend.delete({ workspace: 'personal', id: cap.id });
    expect(del.source_path).toBe(cap.source_path);
    expect(nodeFs.existsSync(join(dir, cap.path))).toBe(false);
    expect(nodeFs.existsSync(join(dir, cap.source_path!))).toBe(false);
    expect((await headTrailers())['Delete-Of']).toBe(cap.id);
    await expect(backend.readNote({ workspace: 'personal', id: cap.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  test('undo removes the note resolved by capture_id', async () => {
    const backend = makeBackend();
    await backend.init({ workspace: 'personal', conventionVersion: 1 });
    const cap = await backend.capture({ workspace: 'personal', output: { body: 'oops' } });
    await backend.undo({ workspace: 'personal', capture_id: cap.capture_id });
    expect(nodeFs.existsSync(join(dir, cap.path))).toBe(false);
    expect((await headTrailers())['Undo-Of']).toBe(cap.capture_id);
  });

  test('ops on an uninitialized dir raise WorkspaceNotInitializedError / null', async () => {
    const backend = makeBackend();
    await expect(
      backend.capture({ workspace: 'personal', output: { body: 'x' } }),
    ).rejects.toBeInstanceOf(WorkspaceNotInitializedError);
    expect(
      await backend.head({ workspace: 'personal', id: '01HZZZA1B2C3D4E5F6G7H8J9K0' }),
    ).toBeNull();
  });
});
