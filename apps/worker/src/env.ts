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
  /** Rate-limit binding (absent in local dev). */
  RATE_LIMITER?: RateLimiter;
  /** Metrics binding (absent in local dev). */
  METRICS?: AnalyticsEngine;
  /** Operator Sentry DSN (wired in 1(e)). */
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
  RELEASE_SHA?: string;
}

/** One resolved workspace entry from the static map. */
export interface WorkspaceResolution {
  owner: string;
  repo: string;
  token: string;
  /** Shared secret embedded in the request URL (path-secret auth, v1.0). */
  path_secret: string;
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
