import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from '../args.ts';
import {
  cmdAppend,
  cmdCapture,
  cmdCorrect,
  cmdDelete,
  cmdImport,
  cmdInit,
  cmdList,
  cmdRead,
  cmdSearch,
  cmdTags,
  cmdUndo,
  cmdWorkspaces,
} from '../commands.ts';

let home: string;
const prev = process.env.ZONOT_HOME;

/** Run a handler with stdout captured (non-TTY → handlers emit NDJSON). */
async function run<T = unknown>(
  fn: () => number | Promise<number>,
): Promise<{ code: number; json: T }> {
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((s: string) => {
    chunks.push(String(s));
    return true;
  }) as typeof process.stdout.write;
  try {
    const code = await fn();
    const out = chunks.join('').trim();
    return { code, json: (out ? JSON.parse(out.split('\n')[0] as string) : null) as T };
  } finally {
    process.stdout.write = orig;
  }
}

/** Like run(), but parses every emitted NDJSON line (for search/list/tags). */
async function runLines<T = unknown>(fn: () => number | Promise<number>): Promise<T[]> {
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((s: string) => {
    chunks.push(String(s));
    return true;
  }) as typeof process.stdout.write;
  try {
    await fn();
    return chunks
      .join('')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as T);
  } finally {
    process.stdout.write = orig;
  }
}

/** Run with stdin reported as a TTY (so handlers don't block reading stdin). */
async function asTty<T>(fn: () => T | Promise<T>): Promise<T> {
  const desc = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  try {
    return await fn();
  } finally {
    if (desc) Object.defineProperty(process.stdin, 'isTTY', desc);
  }
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'zonot-cmd-'));
  process.env.ZONOT_HOME = home;
});
afterEach(async () => {
  if (prev === undefined) delete process.env.ZONOT_HOME;
  else process.env.ZONOT_HOME = prev;
  await rm(home, { recursive: true, force: true });
});

describe('command loop (init → capture → read → append → correct → undo)', () => {
  test('full local dogfood loop', async () => {
    await run(() => cmdInit(parseArgs(['init'])));

    const cap = await run<{ id: string; applied_tags: string[] }>(() =>
      cmdCapture(parseArgs(['capture', 'hello #design @launch'])),
    );
    const id = cap.json.id;
    expect(cap.json.applied_tags).toEqual(['design']);

    type Note = {
      frontmatter: { thread?: string; title?: string };
      body_compiled: string;
      body_timeline: string;
    };
    const read = await run<Note>(() => cmdRead(parseArgs(['read', id])));
    expect(read.json.frontmatter.thread).toBe('launch');
    expect(read.json.body_compiled.trim()).toBe('hello #design @launch');

    await run(() => cmdAppend(parseArgs(['append', id, '- 2026-06-28 | event'])));
    const afterAppend = await run<Note>(() => cmdRead(parseArgs(['read', id])));
    expect(afterAppend.json.body_timeline).toContain('event');

    await run(() => cmdCorrect(parseArgs(['correct', id, 'corrected body', '--title=Fixed'])));
    const afterCorrect = await run<Note>(() => cmdRead(parseArgs(['read', id])));
    expect(afterCorrect.json.frontmatter.title).toBe('Fixed');
    expect(afterCorrect.json.body_compiled.trim()).toBe('corrected body');
    expect(afterCorrect.json.body_timeline).toContain('event'); // timeline preserved

    await run(() => cmdUndo(parseArgs(['undo', id])));
    await expect(run(() => cmdRead(parseArgs(['read', id])))).rejects.toBeInstanceOf(Error); // gone
  });

  test('capture with no body (interactive) is a ConfigError', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    await asTty(() =>
      expect(run(() => cmdCapture(parseArgs(['capture'])))).rejects.toThrow(/body/),
    );
  });

  test('delete removes the note (subsequent read 404s)', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    const cap = await run<{ id: string }>(() => cmdCapture(parseArgs(['capture', 'doomed'])));
    expect((await run(() => cmdDelete(parseArgs(['delete', cap.json.id])))).code).toBe(0);
    await expect(run(() => cmdRead(parseArgs(['read', cap.json.id])))).rejects.toBeInstanceOf(
      Error,
    );
  });

  test('capture with no body but a title is allowed (empty-body capture)', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    const cap = await asTty(() =>
      run<{ id: string }>(() => cmdCapture(parseArgs(['capture', '--title=Just a title']))),
    );
    const note = await run<{ frontmatter: { title: string } }>(() =>
      cmdRead(parseArgs(['read', cap.json.id])),
    );
    expect(note.json.frontmatter.title).toBe('Just a title');
  });

  test('workspaces lists the configured workspace as default (NDJSON, one per line)', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    const ws = await runLines<{ name: string; default: boolean }>(() =>
      cmdWorkspaces(parseArgs(['workspaces'])),
    );
    expect(ws[0]).toMatchObject({ name: 'personal', default: true });
  });
});

describe('argument validation (a bad flag must error, never drop data)', () => {
  test('--title=X (the only supported form) lands title in frontmatter', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    const cap = await run<{ id: string }>(() =>
      cmdCapture(parseArgs(['capture', 'body', '--title=Real Title'])),
    );
    const note = await run<{ frontmatter: { title?: string } }>(() =>
      cmdRead(parseArgs(['read', cap.json.id])),
    );
    expect(note.json.frontmatter.title).toBe('Real Title');
  });

  test('--title "value" (space form) is rejected instead of silently dropping the title', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    // parseArgs has no way to know `--title` takes a value, so the unquoted
    // form parses as a boolean `title` flag plus a stray "Space Title"
    // positional — the shape that would otherwise silently eat the title.
    await expect(
      run(() => cmdCapture(parseArgs(['capture', 'body', '--title', 'Space Title']))),
    ).rejects.toThrow(/unexpected argument/);
  });

  test('an unrecognized flag errors instead of being silently ignored', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    await expect(
      run(() => cmdCapture(parseArgs(['capture', 'body', '--titel=Typo']))),
    ).rejects.toThrow(/unknown flag/);
  });

  test('an extra positional beyond what the command consumes errors', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    const cap = await run<{ id: string }>(() => cmdCapture(parseArgs(['capture', 'body'])));
    await expect(
      run(() => cmdAppend(parseArgs(['append', cap.json.id, 'one', 'two']))),
    ).rejects.toThrow(/unexpected argument/);
  });
});

describe('local FTS (search / list / tags)', () => {
  type Summary = { id: string; title: string; tags: string[]; snippet?: string };

  test('search matches body, list groups by tag, tags count', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    await run(() => cmdCapture(parseArgs(['capture', 'launch preparation #design @launch'])));
    await run(() => cmdCapture(parseArgs(['capture', 'budget review #finance'])));
    await run(() => cmdCapture(parseArgs(['capture', 'design tokens #design'])));

    const hits = await runLines<Summary>(() => cmdSearch(parseArgs(['search', 'launch'])));
    expect(hits).toHaveLength(1);
    expect(hits[0]?.title).toBe('');
    expect(hits[0]?.snippet).toContain('<mark>launch</mark>');

    const recent = await runLines<Summary>(() => cmdList(parseArgs(['list'])));
    expect(recent).toHaveLength(3); // newest-first, all notes

    const groups = await runLines<{ key: string; count: number }>(() =>
      cmdList(parseArgs(['list', '--group=tag'])),
    );
    expect(groups.find((g) => g.key === 'design')?.count).toBe(2);

    const tags = await runLines<{ tag: string; count: number }>(() => cmdTags(parseArgs(['tags'])));
    expect(tags).toEqual([
      { tag: 'design', count: 2 },
      { tag: 'finance', count: 1 },
    ]);

    const de = await runLines<{ tag: string }>(() => cmdTags(parseArgs(['tags', '--prefix=fin'])));
    expect(de).toEqual([{ tag: 'finance', count: 1 }]);
  });

  test('the index rebuilds after a write (HEAD moved)', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    await run(() => cmdCapture(parseArgs(['capture', 'first #a'])));
    expect(await runLines(() => cmdList(parseArgs(['list'])))).toHaveLength(1);
    await run(() => cmdCapture(parseArgs(['capture', 'second #b'])));
    expect(await runLines(() => cmdList(parseArgs(['list'])))).toHaveLength(2); // picked up the new note
  });
});

describe('import (bulk)', () => {
  function vault(): string {
    const dir = join(home, 'vault');
    mkdirSync(join(dir, 'sub'), { recursive: true });
    writeFileSync(join(dir, 'a.md'), '---\ntitle: A\ntags: [x]\ndate: 2024-03-15\n---\nalpha #y\n');
    writeFileSync(join(dir, 'sub', 'b.md'), 'plain beta #z\n');
    return dir;
  }

  test('imports a folder; tags merge (frontmatter + inline); re-import is a no-op', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    const dir = vault();

    const first = await run<{ written: number; new: number }>(() =>
      cmdImport(parseArgs(['import', dir])),
    );
    expect(first.json).toMatchObject({ written: 2, new: 2 });
    expect(await runLines(() => cmdList(parseArgs(['list'])))).toHaveLength(2);

    const tags = await runLines<{ tag: string }>(() => cmdTags(parseArgs(['tags'])));
    expect(tags.map((t) => t.tag).sort()).toEqual(['x', 'y', 'z']); // [x] + #y + #z

    // a.md's frontmatter date drives the path year.
    const hits = await runLines<{ path: string }>(() => cmdSearch(parseArgs(['search', 'alpha'])));
    expect(hits[0]?.path).toMatch(/^notes\/2024\/03\//);

    // Re-import unchanged → nothing written, no new commit.
    const second = await run<{ written: number; unchanged: number }>(() =>
      cmdImport(parseArgs(['import', dir])),
    );
    expect(second.json).toMatchObject({ written: 0, unchanged: 2 });
    expect(await runLines(() => cmdList(parseArgs(['list'])))).toHaveLength(2);
  });

  test('editing a note title + re-importing updates in place (no orphan)', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    const dir = join(home, 'vault-edit');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'note.md');
    writeFileSync(file, '---\ntitle: Original\ntags: [t]\ndate: 2024-01-01\n---\nbody\n');
    await run(() => cmdImport(parseArgs(['import', dir])));
    const before = await runLines<{ id: string; path: string }>(() => cmdList(parseArgs(['list'])));
    expect(before).toHaveLength(1);

    // Same file, edited title → same id (keyed on ctime), updates the existing note.
    writeFileSync(file, '---\ntitle: Renamed\ntags: [t]\ndate: 2024-01-01\n---\nbody changed\n');
    const re = await run<{ written: number; update: number }>(() =>
      cmdImport(parseArgs(['import', dir])),
    );
    expect(re.json).toMatchObject({ update: 1 });
    const after = await runLines<{ id: string; path: string }>(() => cmdList(parseArgs(['list'])));
    expect(after).toHaveLength(1); // not duplicated
    expect(after[0]?.id).toBe(before[0]?.id); // same identity
    expect(after[0]?.path).toBe(before[0]?.path); // path immutable (kept original slug)
  });

  test('--dry-run plans without writing anything', async () => {
    await run(() => cmdInit(parseArgs(['init'])));
    const dir = vault();
    const plan = await runLines<{ from: string; status: string }>(() =>
      cmdImport(parseArgs(['import', dir, '--dry-run'])),
    );
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ from: 'a.md', status: 'new' });
    expect(await runLines(() => cmdList(parseArgs(['list'])))).toHaveLength(0); // nothing written
  });
});
