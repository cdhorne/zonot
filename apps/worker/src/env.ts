// Worker bindings + per-request context (worker-spec §3). v1.0 resolves
// workspaces from a static JSON secret; v1.1 swaps the resolver for an
// entitlement-store KV lookup with no call-site change (worker-spec §3.1).

/** Cloudflare rate-limit binding surface (worker-spec §3.2). */
export interface RateLimiter {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

/** Workers Analytics Engine binding surface (worker-spec §2.2). */
export interface AnalyticsEngine {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

export interface Env {
  /** Secret: JSON map of workspace → { owner, repo, token, path_secret }. */
  WORKSPACE_MAP_JSON: string;
  /** Idempotency cache (24h TTL). Absent in dev → idempotency is a no-op. */
  IDEMPOTENCY?: import('@cloudflare/workers-types').KVNamespace;
  /** Entitlement store, managed (v1.1) deployments only (managed-spec §2).
   *  Absent in v1.0 / self-host → the static-map resolver is authoritative. */
  ENTITLEMENT?: import('@cloudflare/workers-types').KVNamespace;
  /** GitHub App credentials, managed deployments only (managed-spec §4). The
   *  private keys are PKCS#8 PEM; _PREVIOUS carries the outgoing key during
   *  the 24h rotation overlap (ADR-0037 rotation table). */
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_PRIVATE_KEY_PREVIOUS?: string;
  /** Rate-limit binding (absent in local dev). */
  RATE_LIMITER?: RateLimiter;
  /** Metrics binding (absent in local dev). */
  METRICS?: AnalyticsEngine;
  /** Operator Sentry DSN (wired in 1(e)). */
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
  RELEASE_SHA?: string;
}

/** How the Worker authenticates to GitHub for a workspace (managed-spec §4/§7):
 *  the v1.0 static-map PAT, or a v1.1 App installation minted per request. */
export type GitHubCredential =
  | { kind: 'pat'; token: string }
  | { kind: 'app'; installation_id: number };

/** A dispatched workspace: the repo coordinates + how to authenticate to it.
 *  Built by the v1.0 static-map dispatch or the v1.1 entitlement dispatch —
 *  handlers never see which (worker-spec §3.4). */
export interface WorkspaceResolution {
  owner: string;
  repo: string;
  credential: GitHubCredential;
  branch?: string;
}

/** Everything a handler needs after dispatch (worker-spec §3.1). */
export interface WorkspaceContext {
  workspace: string;
  workspace_hash: string;
  resolution: WorkspaceResolution;
  trace_id: string;
}

/** Per-request ambient passed through the router. workspace_hash/op are filled
 *  in by the transports once known, so logs + metrics carry them even on error. */
export interface RequestContext {
  trace_id: string;
  workspace_hash: string | null;
  op: string | null;
}
