// Workspace dispatch (worker-spec §3.1). Every request resolves a workspace
// before any handler runs. Two dispatchers, one output shape: the v1.0
// static-map + path-secret dispatch (self-host default) and the v1.1
// entitlement dispatch (managed mode). The auth-mode switch that routes
// between them is task 4(c) (managed-spec §3.1).

import { NotFoundError, UnauthorizedError } from '@zonot/core/errors';
import {
  EntitlementInactiveError,
  type EntitlementStore,
  isEntitled,
  type WaitUntil,
} from './entitlement.ts';
import type { Env, WorkspaceContext } from './env.ts';

/** One entry in the WORKSPACE_MAP_JSON secret (v1.0 operator config). */
export interface StaticWorkspaceEntry {
  owner: string;
  repo: string;
  token: string;
  /** Shared secret embedded in the request URL (path-secret auth, v1.0). */
  path_secret: string;
  branch?: string;
}

/** SHA-256 hash of the workspace name — the only workspace identifier that ever
 *  reaches logs/metrics/Sentry (worker-spec §2.1 forbidden-fields rule). */
export async function hashWorkspace(workspace: string): Promise<string> {
  const bytes = new TextEncoder().encode(workspace);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

/** v1.0 resolver — static map from the WORKSPACE_MAP_JSON secret. */
export function resolveWorkspace(workspace: string, env: Env): StaticWorkspaceEntry | null {
  let map: Record<string, StaticWorkspaceEntry>;
  try {
    map = JSON.parse(env.WORKSPACE_MAP_JSON) as Record<string, StaticWorkspaceEntry>;
  } catch {
    // A malformed secret is an operator misconfiguration, not a caller error.
    throw new Error('WORKSPACE_MAP_JSON is not valid JSON');
  }
  return map[workspace] ?? null;
}

/**
 * v1.0 dispatch: resolve the workspace named in the request and verify the
 * path-secret (constant-time). Throws NotFoundError for an unknown workspace,
 * UnauthorizedError for a bad/missing secret. Both are deliberately
 * indistinguishable in timing.
 */
export async function dispatchWorkspace(
  workspace: string,
  pathSecret: string | null,
  env: Env,
  trace_id: string,
): Promise<WorkspaceContext> {
  const entry = resolveWorkspace(workspace, env);
  if (!entry) {
    // Burn a comparison so unknown-workspace and bad-secret cost the same.
    constantTimeEquals(pathSecret ?? '', 'x');
    throw new NotFoundError(`workspace ${workspace}`);
  }
  if (!pathSecret || !constantTimeEquals(pathSecret, entry.path_secret)) {
    throw new UnauthorizedError('invalid workspace path-secret');
  }
  return {
    workspace,
    workspace_hash: await hashWorkspace(workspace),
    resolution: {
      owner: entry.owner,
      repo: entry.repo,
      credential: { kind: 'pat', token: entry.token },
      ...(entry.branch ? { branch: entry.branch } : {}),
    },
    trace_id,
  };
}

/**
 * v1.1 dispatch (managed-spec §2.2): the authenticated account's entitlement
 * record → WorkspaceContext. The account id scopes the lookup, so a tenant can
 * never resolve another account's workspace (ADR-0037 §Bright lines) — an
 * unknown pair is a plain 404, indistinguishable from a workspace that doesn't
 * exist. Known but not entitled → 403 entitlement-inactive. No secret
 * comparison happens here (the caller was already authenticated — 4(c)), so
 * there is no constant-time obligation on this path.
 */
export async function dispatchManagedWorkspace(
  accountId: string,
  workspace: string,
  store: EntitlementStore,
  trace_id: string,
  opts: { now?: Date; waitUntil?: WaitUntil } = {},
): Promise<WorkspaceContext> {
  const record = await store.get(accountId, workspace, opts.waitUntil);
  if (!record) throw new NotFoundError(`workspace ${workspace}`);
  if (!isEntitled(record, opts.now ?? new Date())) throw new EntitlementInactiveError(workspace);
  return {
    workspace,
    workspace_hash: await hashWorkspace(workspace),
    resolution: {
      owner: record.github.owner,
      repo: record.github.repo,
      credential: { kind: 'app', installation_id: record.github.installation_id },
      ...(record.github.branch ? { branch: record.github.branch } : {}),
    },
    trace_id,
  };
}

/** Best-effort constant-time string compare (JS string ops aren't a hard timing
 *  guarantee, but this avoids the obvious early-exit byte-by-byte leak). */
export function constantTimeEquals(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
