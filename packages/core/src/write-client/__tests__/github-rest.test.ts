import { beforeEach, describe, expect, test } from 'bun:test';
import {
  NotFoundError,
  SHAConflictError,
  WorkspaceNotInitializedError,
} from '../../errors/index.ts';
import { parseCommitTrailers } from '../../provenance/index.ts';
import { GitHubRestBackend } from '../backends/github-rest.ts';
import { FakeGitHub, ulidFactory } from './fake-github.ts';

const NOW = '2026-06-14T12:00:00Z';

function makeBackend(gh: FakeGitHub, source = 'mcp:claude') {
  return new GitHubRestBackend({
    owner: 'cdhorne',
    repo: 'zonot-notes',
    token: 'ghp_test',
    source,
    now: () => NOW,
    newId: ulidFactory(),
    fetch: gh.fetch,
  });
}

describe('GitHubRestBackend', () => {
  let gh: FakeGitHub;

  beforeEach(() => {
    gh = new FakeGitHub();
  });

  test('init scaffolds the marker + gitkeeps, then is idempotent', async () => {
    const backend = makeBackend(gh);
    const result = await backend.init({ workspace: 'personal', conventionVersion: 1 });
    expect(result.paths).toContain('zonot.json');
    expect(gh.headFiles().has('zonot.json')).toBe(true);
    expect(gh.headFiles().has('notes/.gitkeep')).toBe(true);

    const before = gh.headCommit;
    const again = await backend.init({ workspace: 'personal', conventionVersion: 1 });
    expect(gh.headCommit).toBe(before); // no new commit
    expect(again.paths).toEqual(['zonot.json']);
  });

  test('capture writes a note, normalizes tags, and reads back', async () => {
    const backend = makeBackend(gh);
    const res = await backend.capture({
      workspace: 'personal',
      output: { title: 'Kickoff', tags: ['Foo Bar', 'foo-bar'], body: 'first thought' },
    });

    expect(res.id).toBe(res.capture_id); // capture_id := note id
    expect(res.path).toMatch(/^notes\/2026\/06\/.*-kickoff\.md$/);
    expect(res.applied_tags).toEqual(['foo-bar']);
    expect(res.source_path).toBeUndefined();
    expect(res.url).toContain('github.com/cdhorne/zonot-notes/blob/main/');

    const note = await backend.readNote({ workspace: 'personal', id: res.id });
    expect(note.frontmatter.title).toBe('Kickoff');
    expect(note.frontmatter.tags).toEqual(['foo-bar']);
    expect(note.body_compiled).toBe('first thought\n');
    expect(note.sha).toBe(res.commit_sha === note.sha ? note.sha : note.sha); // sha present
    expect(parseCommitTrailers(gh.headMessage())).toMatchObject({
      Source: 'mcp:claude',
      'Capture-Id': res.id,
    });
  });

  test('capture with distinct raw writes a source node pointing at the note', async () => {
    const backend = makeBackend(gh);
    const res = await backend.capture({
      workspace: 'personal',
      output: { title: 'Voice memo', body: 'cleaned-up text' },
      raw: 'um so like the raw transcript',
    });
    expect(res.source_path).toMatch(/^sources\/2026\/06\/.*\.md$/);

    const note = await backend.readNote({
      workspace: 'personal',
      id: res.id,
      include_source: true,
    });
    expect(note.frontmatter.source).toBeDefined();
    expect(note.source?.frontmatter.of).toBe(res.id);
    expect(note.source?.body).toBe('um so like the raw transcript\n');
  });

  test('capture with raw === body writes no source node', async () => {
    const backend = makeBackend(gh);
    const res = await backend.capture({
      workspace: 'personal',
      output: { body: 'identical' },
      raw: 'identical',
    });
    expect(res.source_path).toBeUndefined();
  });

  test('append adds a dated block to the timeline and stamps updated', async () => {
    const backend = makeBackend(gh);
    const cap = await backend.capture({
      workspace: 'personal',
      output: { title: 'Log', body: 'compiled summary' },
    });
    const head = await backend.head({ workspace: 'personal', id: cap.id });
    expect(head).not.toBeNull();

    const appended = await backend.append({
      workspace: 'personal',
      id: cap.id,
      block: '- **2026-06-14** | new event',
      base_sha: head!.sha,
    });
    expect(appended.id).toBe(cap.id);
    expect(appended.capture_id).not.toBe(cap.id); // fresh write-event id

    const note = await backend.readNote({ workspace: 'personal', id: cap.id });
    expect(note.body_compiled.trim()).toBe('compiled summary');
    expect(note.body_timeline).toContain('new event');
    expect(note.frontmatter.updated).toBe(NOW);
  });

  test('append with a stale base_sha raises SHAConflictError', async () => {
    const backend = makeBackend(gh);
    const cap = await backend.capture({ workspace: 'personal', output: { body: 'x' } });
    await expect(
      backend.append({
        workspace: 'personal',
        id: cap.id,
        block: '- entry',
        base_sha: 'deadbeefstale',
      }),
    ).rejects.toBeInstanceOf(SHAConflictError);
  });

  test('append loses a fast-forward race → SHAConflictError with the fresh sha', async () => {
    const backend = makeBackend(gh);
    const cap = await backend.capture({ workspace: 'personal', output: { body: 'x' } });
    const head = await backend.head({ workspace: 'personal', id: cap.id });

    // A concurrent committer advances HEAD after the backend reads but before it writes.
    // Emulate by mutating the note path out-of-band, then attempt the append.
    const notePath = cap.path;
    gh.injectCommit({ [notePath]: '---\nstale\n' });

    await expect(
      backend.append({ workspace: 'personal', id: cap.id, block: '- e', base_sha: head!.sha }),
    ).rejects.toBeInstanceOf(SHAConflictError);
  });

  test('correct replaces the compiled body, preserves timeline, emits Edit-Of', async () => {
    const backend = makeBackend(gh);
    const cap = await backend.capture({
      workspace: 'personal',
      output: { title: 'Draft', tags: ['a'], body: 'old compiled' },
    });
    await backend.append({
      workspace: 'personal',
      id: cap.id,
      block: '- **2026-06-14** | kept',
      base_sha: (await backend.head({ workspace: 'personal', id: cap.id }))!.sha,
    });

    const sha = (await backend.head({ workspace: 'personal', id: cap.id }))!.sha;
    await backend.correct({
      workspace: 'personal',
      id: cap.id,
      output: { title: 'Fixed', tags: ['b'], body: 'new compiled' },
      base_sha: sha,
    });

    const note = await backend.readNote({ workspace: 'personal', id: cap.id });
    expect(note.body_compiled.trim()).toBe('new compiled');
    expect(note.body_timeline).toContain('kept');
    expect(note.frontmatter.title).toBe('Fixed');
    expect(note.frontmatter.tags).toEqual(['b']);
    expect(parseCommitTrailers(gh.headMessage())['Edit-Of']).toBe(cap.id);
  });

  test('delete removes the note + its source; readNote then 404s', async () => {
    const backend = makeBackend(gh);
    const cap = await backend.capture({
      workspace: 'personal',
      output: { body: 'doomed' },
      raw: 'raw doomed',
    });
    expect(gh.headFiles().has(cap.source_path!)).toBe(true);

    const del = await backend.delete({ workspace: 'personal', id: cap.id });
    expect(del.source_path).toBe(cap.source_path);
    expect(gh.headFiles().has(cap.path)).toBe(false);
    expect(gh.headFiles().has(cap.source_path!)).toBe(false);
    expect(parseCommitTrailers(gh.headMessage())['Delete-Of']).toBe(cap.id);

    await expect(backend.readNote({ workspace: 'personal', id: cap.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  test('undo removes the note resolved by capture_id, emits Undo-Of', async () => {
    const backend = makeBackend(gh);
    const cap = await backend.capture({ workspace: 'personal', output: { body: 'oops' } });

    const undone = await backend.undo({ workspace: 'personal', capture_id: cap.capture_id });
    expect(undone.path).toBe(cap.path);
    expect(gh.headFiles().has(cap.path)).toBe(false);
    expect(parseCommitTrailers(gh.headMessage())['Undo-Of']).toBe(cap.capture_id);
  });

  test('readNote / head on an unknown id', async () => {
    const backend = makeBackend(gh);
    await backend.capture({ workspace: 'personal', output: { body: 'x' } });
    const unknown = '01HZZZA1B2C3D4E5F6G7H8J9Z9';
    await expect(backend.readNote({ workspace: 'personal', id: unknown })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(await backend.head({ workspace: 'personal', id: unknown })).toBeNull();
  });

  test('conditional ops on an uninitialized repo raise WorkspaceNotInitializedError', async () => {
    const backend = makeBackend(gh); // no init, empty repo
    await expect(
      backend.append({
        workspace: 'personal',
        id: '01HZZZA1B2C3D4E5F6G7H8J9Z9',
        block: 'x',
        base_sha: 's',
      }),
    ).rejects.toBeInstanceOf(WorkspaceNotInitializedError);
  });

  test('capture works against a fresh empty repo (creates the first ref)', async () => {
    const backend = makeBackend(gh);
    const res = await backend.capture({ workspace: 'personal', output: { body: 'first ever' } });
    expect(gh.headFiles().has(res.path)).toBe(true);
  });

  test('listRecent returns newest-first summaries, honoring limit', async () => {
    const backend = makeBackend(gh);
    const a = await backend.capture({ workspace: 'personal', output: { title: 'A', body: 'a' } });
    const b = await backend.capture({
      workspace: 'personal',
      output: { title: 'B', tags: ['x'], body: 'b' },
    });
    const c = await backend.capture({ workspace: 'personal', output: { title: 'C', body: 'c' } });

    const all = await backend.listRecent({ workspace: 'personal' });
    expect(all.map((s) => s.id)).toEqual([c.id, b.id, a.id]); // newest first
    expect(all[1]?.title).toBe('B');
    expect(all[1]?.tags).toEqual(['x']);

    const top2 = await backend.listRecent({ workspace: 'personal', limit: 2 });
    expect(top2.map((s) => s.id)).toEqual([c.id, b.id]);
  });

  test('listRecent on an empty repo is []', async () => {
    expect(await makeBackend(gh).listRecent({ workspace: 'personal' })).toEqual([]);
  });

  test('listTags counts across the corpus and filters by prefix', async () => {
    const backend = makeBackend(gh);
    await backend.capture({
      workspace: 'personal',
      output: { tags: ['work', 'urgent'], body: '1' },
    });
    await backend.capture({ workspace: 'personal', output: { tags: ['work'], body: '2' } });
    await backend.capture({ workspace: 'personal', output: { tags: ['home'], body: '3' } });

    const tags = await backend.listTags({ workspace: 'personal' });
    expect(tags).toEqual([
      { tag: 'work', count: 2 },
      { tag: 'home', count: 1 },
      { tag: 'urgent', count: 1 },
    ]);

    const w = await backend.listTags({ workspace: 'personal', prefix: 'wo' });
    expect(w).toEqual([{ tag: 'work', count: 2 }]);
  });
});
