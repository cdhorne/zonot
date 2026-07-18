import { describe, expect, test } from 'bun:test';
import { normalizeRepoUrl, resolveToken } from '../sync.ts';

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
