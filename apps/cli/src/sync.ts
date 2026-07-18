// The CLI sync layer (cli-spec §4; ADR-0010/0022 — git is the device-sync
// protocol). The IsomorphicGitBackend deliberately stops at local commits
// ("push is a separate, scheduled concern"); this module is that separate
// concern. It pushes the local mirror's commits up to the workspace's GitHub
// repo and fast-forwards in anything the remote has that we don't — no
// hand-rolled changes feed, just git over HTTPS with a token.
//
// Conflict handling is intentionally conservative: creates are conflict-free by
// design (a new ULID-named file per note), so a fast-forward covers the common
// case. A genuinely diverged history (e.g. a correction race across two devices)
// is surfaced as an actionable error rather than a silent force-push — history
// rewrite stays gated (ADR-0004/0026).

import { spawnSync } from 'node:child_process';
import nodeFs from 'node:fs';
import { UnauthorizedError, UpstreamDownError } from '@zonot/core/errors';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import { ConfigError } from './config.ts';

export interface SyncResult {
  remote: string;
  branch: string;
  /** Commits sent to the remote this run. */
  pushed: number;
  /** Commits fast-forwarded in from the remote this run. */
  pulled: number;
  /** True when neither side moved — nothing to do. */
  up_to_date: boolean;
}

export interface SyncOptions {
  dir: string;
  /** The workspace's configured upstream (any accepted form; normalized here). */
  repo: string;
  branch?: string;
  author: { name: string; email: string };
  /** Token override (tests); production resolves via resolveToken(). */
  token?: string;
  /** fs override (tests); defaults to node:fs. */
  fs?: typeof nodeFs;
}

/**
 * Normalize any of the repo spellings we accept into the HTTPS URL the token
 * transport needs: `owner/repo` shorthand, `git@host:owner/repo(.git)`,
 * `ssh://git@host/owner/repo(.git)`, or a full http(s) URL.
 */
export function normalizeRepoUrl(repo: string): string {
  const r = repo.trim();
  if (!r) throw new ConfigError('workspace has no repo configured — `zonot init --repo=…`');

  const scp = r.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (scp) return `https://${scp[1]}/${scp[2]}.git`;

  const sshUrl = r.match(/^ssh:\/\/git@([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshUrl) return `https://${sshUrl[1]}/${sshUrl[2]}.git`;

  if (/^https?:\/\//.test(r)) return r.endsWith('.git') ? r : `${r}.git`;

  if (/^[\w.-]+\/[\w.-]+$/.test(r)) return `https://github.com/${r}.git`;

  throw new ConfigError(`unrecognized repo URL: ${repo}`);
}

/**
 * Resolve a push token without persisting it: env first (explicit, CI-friendly),
 * then the GitHub CLI (`gh auth token`) so a dev machine that's already `gh
 * auth login`'d just works. Never written to config — a plaintext secret at rest
 * would undercut the trust model (ADR-0001/0037).
 */
export function resolveToken(opts?: { env?: NodeJS.ProcessEnv; gh?: () => string | null }): string {
  const env = opts?.env ?? process.env;
  const fromEnv = env.ZONOT_TOKEN || env.GITHUB_TOKEN || env.GH_TOKEN;
  if (fromEnv?.trim()) return fromEnv.trim();

  const gh = opts?.gh ?? defaultGhToken;
  const fromGh = gh();
  if (fromGh?.trim()) return fromGh.trim();

  throw new ConfigError(
    'no GitHub token — set ZONOT_TOKEN (or GITHUB_TOKEN), or run `gh auth login`',
  );
}

function defaultGhToken(): string | null {
  try {
    const r = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
  } catch {
    return null;
  }
}

// GitHub HTTPS basic auth: username `x-access-token`, password = the token.
// Works uniformly for classic PATs, fine-grained PATs, and gh OAuth tokens.
type OnAuth = () => { username: string; password: string };
const onAuthFor =
  (token: string): OnAuth =>
  () => ({ username: 'x-access-token', password: token });

/** Resolve a token if one is available, else undefined (public-repo / no-auth paths). */
function tryToken(): string | undefined {
  try {
    return resolveToken();
  } catch {
    return undefined;
  }
}

/** Push local commits to the remote, fast-forwarding in anything we're behind on. */
export async function syncWorkspace(opts: SyncOptions): Promise<SyncResult> {
  const fs = opts.fs ?? nodeFs;
  const dir = opts.dir.replace(/\/$/, '');
  const branch = opts.branch ?? 'main';
  const url = normalizeRepoUrl(opts.repo);
  const token = opts.token ?? resolveToken();
  const onAuth = onAuthFor(token);

  const localBefore = await resolveRef(fs, dir, branch);
  if (!localBefore) throw new ConfigError('nothing committed yet — capture something first');

  // Probe the remote up front so auth/network failures surface cleanly here,
  // rather than being mistaken for "remote is empty" during fetch.
  const remoteBranchOid = await probeRemoteBranch(url, branch, onAuth);

  let pulled = 0;
  await git.addRemote({ fs, dir, remote: 'origin', url, force: true });

  if (remoteBranchOid) {
    await git.fetch({
      fs,
      http,
      dir,
      remote: 'origin',
      ref: branch,
      singleBranch: true,
      tags: false,
      onAuth,
    });
    const remoteOid = await resolveRef(fs, dir, `refs/remotes/origin/${branch}`);
    if (remoteOid && remoteOid !== localBefore) {
      pulled = await reconcile(fs, dir, branch, localBefore, remoteOid, opts.author);
    }
  }

  const localAfterPull = await resolveRef(fs, dir, branch);
  const pushed = await countAhead(fs, dir, localAfterPull, remoteBranchOid);

  if (pushed > 0) {
    const result = await git.push({
      fs,
      http,
      dir,
      remote: 'origin',
      ref: branch,
      remoteRef: branch,
      onAuth,
    });
    if (result.error) throw pushError(result.error);
  }

  return {
    remote: url,
    branch,
    pushed,
    pulled,
    up_to_date: pushed === 0 && pulled === 0,
  };
}

/**
 * Move the local branch to include the remote's commits. Fast-forward when the
 * remote strictly leads; otherwise attempt a real merge (clean when both sides
 * only added distinct note files — the conflict-free create case). A merge that
 * can't be resolved without rewriting history is refused with guidance.
 */
async function reconcile(
  fs: typeof nodeFs,
  dir: string,
  branch: string,
  localOid: string,
  remoteOid: string,
  author: { name: string; email: string },
): Promise<number> {
  const bases = await git.findMergeBase({ fs, dir, oids: [localOid, remoteOid] });
  const base = bases[0];

  if (base === remoteOid) return 0; // local already contains the remote — nothing to pull.

  const beforeCount = await countAhead(fs, dir, localOid, base ?? null);

  try {
    await git.merge({
      fs,
      dir,
      ours: branch,
      theirs: remoteOid,
      fastForward: true,
      author,
      message: `sync: merge origin/${branch}`,
    });
  } catch {
    throw new ConfigError(
      `local and origin/${branch} have diverged and can't be merged automatically — ` +
        'resolve it in the mirror with git, then re-run `zonot sync`',
    );
  }
  await git.checkout({ fs, dir, ref: branch, force: true });

  const afterOid = await resolveRef(fs, dir, branch);
  const afterCount = await countAhead(fs, dir, afterOid, base ?? null);
  // Commits gained that weren't ours before = what we pulled in.
  return Math.max(0, afterCount - beforeCount);
}

/**
 * getRemoteInfo doubles as the auth/reachability probe and the branch check.
 * onAuth is optional so `init` can probe a public repo before any token exists;
 * an empty repo returns no head → null (not an error).
 */
async function probeRemoteBranch(
  url: string,
  branch: string,
  onAuth?: OnAuth,
): Promise<string | null> {
  try {
    const info = await git.getRemoteInfo({ http, url, ...(onAuth ? { onAuth } : {}) });
    const heads = (info.refs?.heads ?? {}) as Record<string, string>;
    return heads[branch] ?? null;
  } catch (err) {
    throw remoteError(err);
  }
}

async function resolveRef(fs: typeof nodeFs, dir: string, ref: string): Promise<string | null> {
  try {
    return await git.resolveRef({ fs, dir, ref });
  } catch {
    return null;
  }
}

/** Commits reachable from `tip` but not from `base` (bounded log walk). */
async function countAhead(
  fs: typeof nodeFs,
  dir: string,
  tip: string | null,
  base: string | null,
): Promise<number> {
  if (!tip) return 0;
  if (tip === base) return 0;
  const seen = new Set<string>();
  if (base) {
    for (const c of await git.log({ fs, dir, ref: base, depth: 5000 })) seen.add(c.oid);
  }
  let n = 0;
  for (const c of await git.log({ fs, dir, ref: tip, depth: 5000 })) {
    if (seen.has(c.oid)) break;
    n++;
  }
  return n;
}

function remoteError(err: unknown): Error {
  const msg = String((err as { message?: string })?.message ?? err);
  if (/401|403|auth|permission|credential/i.test(msg)) {
    return new UnauthorizedError(`GitHub rejected the token: ${msg}`);
  }
  return new UpstreamDownError(`could not reach the remote: ${msg}`);
}

function pushError(err: unknown): Error {
  const msg = String((err as { message?: string })?.message ?? err);
  if (/not.*fast.?forward|stale|rejected/i.test(msg)) {
    return new UpstreamDownError(`push rejected (remote moved) — re-run \`zonot sync\`: ${msg}`);
  }
  return new UpstreamDownError(`push failed: ${msg}`);
}

/**
 * If the upstream already has the branch, clone it into `dir` so we adopt its
 * history instead of starting a divergent empty one (which `sync` would then
 * refuse to merge). Returns false when the remote is empty — the caller then
 * does the local init + scaffold and the first `sync` pushes.
 */
export async function cloneExistingRepo(opts: {
  dir: string;
  repo: string;
  branch?: string;
  fs?: typeof nodeFs;
}): Promise<boolean> {
  const fs = opts.fs ?? nodeFs;
  const dir = opts.dir.replace(/\/$/, '');
  const branch = opts.branch ?? 'main';
  const url = normalizeRepoUrl(opts.repo);
  const token = tryToken();
  const onAuth = token ? onAuthFor(token) : undefined;

  const remoteOid = await probeRemoteBranch(url, branch, onAuth);
  if (!remoteOid) return false;

  await git.clone({
    fs,
    http,
    dir,
    url,
    ref: branch,
    singleBranch: true,
    ...(onAuth ? { onAuth } : {}),
  });
  return true;
}

export interface SyncState {
  repo?: string;
  branch: string;
  /** Whether we've fetched the remote at least once (a tracking ref exists). */
  tracking: boolean;
  /** Local commits not yet on the remote-tracking ref. */
  ahead: number;
  /** Remote-tracking commits not yet fast-forwarded locally. */
  behind: number;
}

/**
 * Offline sync state for `status`: ahead/behind the *last-fetched*
 * origin/<branch>, from local refs only — no network, no token. `ahead` is the
 * "unsynced captures" signal a dogfooder wants before closing the laptop.
 */
export async function localSyncState(opts: {
  dir: string;
  repo?: string;
  branch?: string;
  fs?: typeof nodeFs;
}): Promise<SyncState> {
  const fs = opts.fs ?? nodeFs;
  const dir = opts.dir.replace(/\/$/, '');
  const branch = opts.branch ?? 'main';
  const local = await resolveRef(fs, dir, branch);
  const tracked = await resolveRef(fs, dir, `refs/remotes/origin/${branch}`);
  const ahead = tracked ? await countAhead(fs, dir, local, tracked) : 0;
  const behind = tracked ? await countAhead(fs, dir, tracked, local) : 0;
  return {
    branch,
    tracking: tracked !== null,
    ahead,
    behind,
    ...(opts.repo ? { repo: opts.repo } : {}),
  };
}
