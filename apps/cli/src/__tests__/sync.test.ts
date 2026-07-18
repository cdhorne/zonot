import { describe, expect, test } from 'bun:test';
import nodeFs from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import git from 'isomorphic-git';
import { localSyncState, normalizeRepoUrl, resolveToken } from '../sync.ts';

const author = { name: 'Test', email: 'test@localhost' };

async function commitFile(dir: string, name: string, timestamp?: number): Promise<string> {
  await writeFile(join(dir, name), name);
  await git.add({ fs: nodeFs, dir, filepath: name });
  const who = timestamp === undefined ? author : { ...author, timestamp, timezoneOffset: 0 };
  return git.commit({ fs: nodeFs, dir, message: `add ${name}`, author: who });
}

describe('normalizeRepoUrl', () => {
  test('owner/repo shorthand → github https', () => {
    expect(normalizeRepoUrl('cdhorne/notes')).toBe('https://github.com/cdhorne/notes.git');
  });

  test('scp-style ssh → https', () => {
    expect(normalizeRepoUrl('git@github.com:cdhorne/notes.git')).toBe(
      'https://github.com/cdhorne/notes.git',
    );
    expect(normalizeRepoUrl('git@github.com:cdhorne/notes')).toBe(
      'https://github.com/cdhorne/notes.git',
    );
  });

  test('ssh:// url → https', () => {
    expect(normalizeRepoUrl('ssh://git@github.com/cdhorne/notes.git')).toBe(
      'https://github.com/cdhorne/notes.git',
    );
  });

  test('https url is kept, .git appended when missing', () => {
    expect(normalizeRepoUrl('https://github.com/cdhorne/notes')).toBe(
      'https://github.com/cdhorne/notes.git',
    );
    expect(normalizeRepoUrl('https://github.com/cdhorne/notes.git')).toBe(
      'https://github.com/cdhorne/notes.git',
    );
  });

  test('tolerates a trailing slash and a shorthand .git without double-suffixing', () => {
    expect(normalizeRepoUrl('https://github.com/cdhorne/notes/')).toBe(
      'https://github.com/cdhorne/notes.git',
    );
    expect(normalizeRepoUrl('cdhorne/notes.git')).toBe('https://github.com/cdhorne/notes.git');
  });

  test('a non-github host survives normalization', () => {
    expect(normalizeRepoUrl('git@gitlab.com:me/notes.git')).toBe('https://gitlab.com/me/notes.git');
  });

  test('empty / unrecognized throws a config error', () => {
    expect(() => normalizeRepoUrl('')).toThrow(/no repo/);
    expect(() => normalizeRepoUrl('not a repo at all')).toThrow(/unrecognized/);
  });
});

describe('resolveToken', () => {
  test('prefers ZONOT_TOKEN over the other env vars', () => {
    expect(resolveToken({ env: { ZONOT_TOKEN: 'z', GITHUB_TOKEN: 'g', GH_TOKEN: 'h' } })).toBe('z');
  });

  test('falls back through GITHUB_TOKEN then GH_TOKEN', () => {
    expect(resolveToken({ env: { GITHUB_TOKEN: 'g', GH_TOKEN: 'h' } })).toBe('g');
    expect(resolveToken({ env: { GH_TOKEN: 'h' } })).toBe('h');
  });

  test('falls back to the gh CLI when no env token', () => {
    expect(resolveToken({ env: {}, gh: () => 'gho_fromcli' })).toBe('gho_fromcli');
  });

  test('env token wins even if gh could answer', () => {
    expect(resolveToken({ env: { ZONOT_TOKEN: 'z' }, gh: () => 'gho_fromcli' })).toBe('z');
  });

  test('throws an actionable config error when nothing provides a token', () => {
    expect(() => resolveToken({ env: {}, gh: () => null })).toThrow(/gh auth login/);
  });

  test('trims surrounding whitespace', () => {
    expect(resolveToken({ env: { ZONOT_TOKEN: '  z  ' } })).toBe('z');
  });
});

describe('localSyncState', () => {
  let dir: string;

  async function makeRepo(): Promise<void> {
    dir = await mkdtemp(join(tmpdir(), 'zonot-sync-'));
    await git.init({ fs: nodeFs, dir, defaultBranch: 'main' });
  }
  const cleanup = () => rm(dir, { recursive: true, force: true });

  test('no tracking ref → tracking false, ahead/behind zero', async () => {
    await makeRepo();
    await commitFile(dir, 'a');
    const state = await localSyncState({ dir, repo: 'o/r' });
    expect(state).toMatchObject({
      branch: 'main',
      tracking: false,
      ahead: 0,
      behind: 0,
      repo: 'o/r',
    });
    await cleanup();
  });

  test('local ahead of the tracking ref counts unpushed commits', async () => {
    await makeRepo();
    const c1 = await commitFile(dir, 'a');
    await git.writeRef({ fs: nodeFs, dir, ref: 'refs/remotes/origin/main', value: c1 });
    await commitFile(dir, 'b');
    await commitFile(dir, 'c');
    const state = await localSyncState({ dir });
    expect(state).toMatchObject({ tracking: true, ahead: 2, behind: 0 });
    expect(state.repo).toBeUndefined();
    await cleanup();
  });

  test('tracking ref ahead of local counts unpulled commits (behind)', async () => {
    await makeRepo();
    const c1 = await commitFile(dir, 'a');
    // Point the local branch back at c1 while the tracking ref leads by two.
    const c2 = await commitFile(dir, 'b');
    const c3 = await commitFile(dir, 'c');
    await git.writeRef({ fs: nodeFs, dir, ref: 'refs/remotes/origin/main', value: c3 });
    await git.writeRef({ fs: nodeFs, dir, ref: 'refs/heads/main', value: c1, force: true });
    const state = await localSyncState({ dir });
    expect(state).toMatchObject({ tracking: true, ahead: 0, behind: 2 });
    expect(c2).toBeDefined();
    await cleanup();
  });

  test('counts merge-commit history correctly (regression: no early break)', async () => {
    await makeRepo();
    // Timestamps are skewed so the shared base (c1@2000) sorts *before* the
    // other-branch commit (c3@1000) in the age-ordered log — the exact shape
    // that made an early break undercount.
    const c1 = await commitFile(dir, 'base', 2000);
    await git.writeRef({ fs: nodeFs, dir, ref: 'refs/remotes/origin/main', value: c1 });
    await commitFile(dir, 'm2', 3000); // c2 on main
    await git.writeRef({ fs: nodeFs, dir, ref: 'refs/heads/other', value: c1, force: true });
    await git.checkout({ fs: nodeFs, dir, ref: 'other' });
    await commitFile(dir, 'o3', 1000); // c3 on other, older than the base
    await git.checkout({ fs: nodeFs, dir, ref: 'main' });
    await git.merge({
      fs: nodeFs,
      dir,
      ours: 'main',
      theirs: 'other',
      author: { ...author, timestamp: 5000, timezoneOffset: 0 },
      message: 'merge other',
    });
    // Ahead of the tracking ref (c1): c2, c3, and the merge commit = 3.
    const state = await localSyncState({ dir });
    expect(state).toMatchObject({ tracking: true, ahead: 3, behind: 0 });
    await cleanup();
  });
});
