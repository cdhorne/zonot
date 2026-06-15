# Worker spec — error discipline, observability, multi-tenant scaffolding

> **Companion to [ADR-0035](../adr/0035-worker-runtime-discipline.md).** This document is the
> implementation contract for `apps/worker` runtime mechanics (Phase 1). It is hand-authored.
> When an ADR and this spec disagree, the ADR wins. ADR-0035's "Decision"
> bullets summarize; this doc carries the operational detail an agent or reviewer needs.

## 0. Scope

What this spec pins:

1. The **error discipline** — RFC 9457 type URI taxonomy, trace propagation, mapping table from
   core errors to HTTP responses.
2. The **observability stack** — structured logs, Workers Analytics Engine metrics, Sentry from
   v1.0, the no-content rule.
3. The **multi-tenant scaffolding** — workspace dispatcher, rate limiter binding, the v1.0 →
   v1.1 backend swap path.
4. The **caching + cold-start strategy** — what's cached where, freshness rules, the honest
   GitHub-REST latency floor.

What this spec deliberately does NOT cover:

- The handler implementations themselves (ADR-0022's "one handler set" — those live in
  `packages/core` per the phase-0 split).
- MCP transport wiring detail (`createMcpHandler` per ADR-0022).
- OAuth/CIMD/GitHub App flow detail (ADR-0017 + a future v1.1 worker rev).
- v1.2 edge-search Durable Object internals (ADR-0009 + a future v1.2 rev).

## 1. Error discipline

### 1.1 Universal RFC 9457

Every non-2xx response is `application/problem+json`. Every 2xx response carries the same
`zonot-trace-id` header. No plain text error bodies. No bespoke error shapes.

```ts
interface ZonotProblem {
  type:     string;        // a https://zonot.app/problems/<name> URI from the taxonomy
  title:    string;        // human-readable short title
  status:   number;        // matches HTTP status
  detail:   string;        // human-readable explanation
  instance?: string;       // optional URI identifying this occurrence

  // Zonot extensions
  trace_id: string;        // ULID matching the zonot-trace-id header
  retryable?: boolean;     // present when 429/502 — true means caller may retry per Retry-After
  errors?:  Array<{        // present when status=400 (validation)
    path:    string;       // JSON pointer into the request body
    message: string;
  }>;
  sha_expected?: string;   // present when type=sha-conflict
  sha_actual?:   string | null;
}
```

### 1.2 Type URI taxonomy

```
type URI                                           HTTP  cause / mapping
https://zonot.app/problems/sha-conflict            412   core SHAConflictError (ADR-0026); caller refetches
https://zonot.app/problems/idempotency-replay      422   core IdempotencyReplayError (24h cache; different body)
https://zonot.app/problems/uninitialized           409   core WorkspaceNotInitializedError
https://zonot.app/problems/not-found               404   note id / workspace not resolvable
https://zonot.app/problems/unauthorized            401   path-secret invalid (v1.0); OAuth token expired (v1.1)
https://zonot.app/problems/rate-limited            429   per-tenant rate limit hit; Retry-After + retryable: true
https://zonot.app/problems/upstream-rate-limited   429   GitHub quota; Retry-After echoed; retryable: true
https://zonot.app/problems/upstream-down           502   GitHub 5xx; retryable: true
https://zonot.app/problems/validation              400   schema / parser fail; errors[] extension populated
https://zonot.app/problems/internal                500   uncaught; logged with trace_id + reported to Sentry
```

### 1.3 Error mapping middleware

A single middleware at the Worker root maps thrown errors → ZonotProblem responses:

```ts
async function handle(req: Request, env: Env): Promise<Response> {
  const trace_id = generateUlid();
  try {
    const res = await router(req, env, { trace_id });
    return withTraceHeader(res, trace_id);
  } catch (err) {
    const problem = toZonotProblem(err, trace_id);
    if (problem.status >= 500) {
      Sentry.captureException(err, { tags: { trace_id, op: opFromReq(req) } });
    }
    return problemResponse(problem);
  }
}
```

The `toZonotProblem` switch dispatches on error class:

```
SHAConflictError          → sha-conflict
IdempotencyReplayError    → idempotency-replay
WorkspaceNotInitializedError → uninitialized
NotFoundError             → not-found
UnauthorizedError         → unauthorized
RateLimitedError          → rate-limited
UpstreamRateLimitedError  → upstream-rate-limited
UpstreamDownError         → upstream-down
ValidationError           → validation
* (everything else)       → internal
```

### 1.4 Trace propagation

- **Every response** carries `zonot-trace-id: <ULID>`.
- **Every log entry** for the request carries the same id.
- **Every Sentry event** for the request carries it as a tag.
- The mobile Sync Details screen surfaces the trace id alongside the error so the user can
  paste it for diagnostics.
- The MCP transport copies the trace id into the response metadata (where MCP allows
  extensions).

## 2. Observability

### 2.1 Logs — structured JSON, content-free

Every request emits one log entry on completion:

```json
{
  "ts": "2026-06-14T14:32:07.412Z",
  "trace_id": "01HZZZA1B2C3D4E5F6G7H8J9K0",
  "workspace_hash": "sha256:abc123...",
  "op": "capture",
  "method": "POST",
  "path": "/v1/capture",
  "status": 200,
  "latency_ms": 1147,
  "upstream_status": 200,
  "upstream_ms": 924,
  "upstream_target": "github:contents",
  "error_type": null
}
```

**Forbidden fields** (never log):
- Note bodies, titles, tags (content).
- User identifiers beyond the hashed workspace (PII).
- Tokens, secrets, headers (security).
- File paths beyond `notes/YYYY/MM/<redacted>.md` shape (content leakage).

**Transport:**
- **Dev:** `wrangler tail` — the maker watches as they dogfood.
- **Prod (v1.1+):** Cloudflare Logpush to R2 or an external sink (operator's choice).
- v1.0 dogfood uses `wrangler tail` only; no Logpush configured.

### 2.2 Metrics — Workers Analytics Engine

```ts
env.METRICS.writeDataPoint({
  blobs: [op, status_class],            // 'capture', '2xx'
  doubles: [latency_ms, upstream_ms],
  indexes: [workspace_hash],
});
```

- Status class buckets: `2xx`, `4xx-client`, `4xx-conflict` (412/422), `4xx-validation`, `5xx`.
- Latency histograms via `doubles`; Analytics Engine queries from the operator dashboard.
- v1.0: queries run ad-hoc; v1.1+: an operator-side dashboard (closed/internal) materializes.

### 2.3 Sentry — operator-side ops reporting, content-free

**Sentry ships from v1.0.** Configuration:

```ts
Sentry.init({
  dsn: env.SENTRY_DSN,                  // operator secret
  environment: env.ENVIRONMENT,         // 'dev' | 'staging' | 'prod'
  release: env.RELEASE_SHA,
  sampleRate: 1.0,                      // 100% errors at v1.0
  tracesSampleRate: 0.0,                // no transaction sampling until traffic is real
  beforeSend(event, hint) {
    return stripContent(event);          // see below
  },
  beforeBreadcrumb(crumb) {
    return crumb.category === 'fetch' ? null : crumb;  // no HTTP body capture
  },
});
```

**`stripContent` discipline:**

- Strip request/response bodies from `event.request` and `event.contexts.response`.
- Strip URL query strings (may contain workspace path-secrets at v1.0).
- Strip the `Authorization` header and all `zonot-*` custom headers except `zonot-trace-id`.
- Allow: tags (`op`, `trace_id`, `workspace_hash`, `error_type`), stack traces, runtime context.

Sentry sees: "a `validation` error occurred at trace_id X in op `capture` for workspace_hash Y;
here's the stack." It never sees: what the user typed, what their tags were, what their tokens
were.

**Sentry projects:** one per environment (`zonot-worker-dev`, `zonot-worker-prod`).

### 2.4 Trace id surfacing for users

The mobile Sync Details screen (mobile-spec §4) shows the trace id of each failed sync alongside
the error. The CLI prints it on error exit. The user pastes the id, the maker greps logs +
Sentry — no content correlation needed.

## 3. Multi-tenant scaffolding

### 3.1 Workspace dispatch

Every request resolves a workspace **before** any handler runs:

```ts
async function dispatchWorkspace(
  req: Request,
  env: Env,
  trace_id: string,
): Promise<WorkspaceContext> {
  const workspace = extractWorkspaceParam(req);  // throws 400 if missing
  const resolution = await resolveWorkspace(workspace, env);
  if (!resolution) throw new NotFoundError(`workspace ${workspace}`);
  return {
    workspace,
    workspace_hash: hashWorkspace(workspace),
    repo: resolution.repo,
    githubToken: resolution.token,
    rateLimiter: env.RATE_LIMITER,
    trace_id,
  };
}
```

The resolver is the swap point:

```ts
// v1.0 implementation
async function resolveWorkspace(ws: string, env: Env): Promise<WorkspaceResolution | null> {
  const map = parseStaticWorkspaceMap(env.WORKSPACE_MAP_JSON);  // secret
  return map.get(ws) ?? null;
}

// v1.1 implementation (same signature)
async function resolveWorkspace(ws: string, env: Env): Promise<WorkspaceResolution | null> {
  const entitlement = await env.ENTITLEMENT_KV.get(`workspace:${ws}`, { type: 'json' });
  if (!entitlement || !entitlement.c1_active) return null;
  const token = await mintGithubAppToken(entitlement.installation_id, entitlement.repo);
  return { repo: entitlement.repo, token };
}
```

No call site changes; backend swap is the difference.

### 3.2 Rate limiter binding

```toml
# wrangler.toml (v1.0 onward)
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "100"
simple = { limit = 60, period = 60 }   # 60 req/min/workspace at v1.0; tuned at v1.1
```

```ts
const decision = await ctx.rateLimiter.limit({ key: `${ctx.workspace_hash}:${op}` });
if (!decision.success) throw new RateLimitedError(decision.retryAfter);
```

Keys are always `(workspace_hash, op)` — never `(workspace_hash)` alone, so a noisy read doesn't
starve a write.

### 3.3 No shared mutable state

The Worker has no module-level mutable state across requests. Each request resolves its
WorkspaceContext and operates within it. Static data (the workspace map at v1.0; KV reads with
short TTL) is cached via `caches.default` per-request, not held in module memory across
requests.

This rule is enforced by a lint check (`no-restricted-syntax: ModuleVariableDeclaration` for
`let`/`var` at module scope in `apps/worker/src`) to prevent regression.

### 3.4 v1.0 → v1.1 transition

| Surface | v1.0 | v1.1 |
|---------|------|------|
| Workspace resolution | static map from secret | entitlement-store KV lookup |
| GitHub auth | one fine-grained PAT in secret | short-lived App-minted token per request |
| Rate limit | trivial (60/min) | per-tier from entitlement (TBD by ADR-0027 packaging) |
| User identity | path-secret only | OAuth account id |
| Logging | `wrangler tail` | + Logpush to R2 |
| Sentry | dev DSN | prod DSN; same wiring |

Every row is a config / backend swap; no architecture change.

## 4. Caching + cold-start

### 4.1 What lives where

| Data | Where | TTL | Stale-while-revalidate? |
|------|-------|-----|------------------------|
| Workspace map (v1.0) | secret, parsed on each cold start | request-lifetime cache | no |
| Entitlement (v1.1) | KV `entitlement:<ws>` | 60s | yes |
| Tag vocab | KV `vocab:<ws>` | 5 min | yes (vocab drift is safe) |
| GitHub repo SHA (current HEAD) | not cached | — | never (authority-or-bust) |
| Note SHA for SHA-conditional ops | not cached | — | never (authority-or-bust) |
| Workers AI / hosted inference (v1.2) | not cached | — | not applicable |

### 4.2 Cold-start budget

> Full per-operation latency table lives in [`perf-budgets.md`](perf-budgets.md) §3. This
> section names the Worker-side cost model the budgets bake in.


- Workers cold start: 5-20 ms (Wrangler v3 / V8 isolates).
- KV read on cold start: ~5-15 ms.
- GitHub REST round-trip: 300-1500 ms — **the dominant cost.**

ADR-0034's `save → ack p50 ≤ 1.2 s` is honest given this. There is no "make the Worker faster"
move that materially helps — only GitHub-side latency reduction (Git Data tree call vs.
two Contents calls — tuned in Phase 1).

### 4.3 Authority-or-bust SHA reads

Every SHA-conditional mutation refetches the head SHA from GitHub before the conditional write.
**Never** cache a SHA between requests; the cost of a stale SHA is a 412 the client has to
handle, which is correct but unnecessary. The optimization is at the *write* path (Git Data
tree to commit note + source atomically), not the *read* path.

## 5. Open items (for Phase 1 to close)

- **Sentry sample rate at scale.** v1.0 = 100% errors / 0% transactions. v1.1 with real traffic:
  evaluate transaction sampling (~1%?) for latency tracing. Defer until traffic exists.
- **Client-side Sentry policy** for mobile + CLI. Currently the mobile spec has local JSONL
  logging only; no Sentry client. Decide at the next mobile/CLI rev cycle.
- **Operator-side SLO/dashboarding shape** for v1.1+. Closed-source / internal dashboard; not
  in this spec.
- **Logpush sink choice at v1.1** (R2 vs. external) — depends on cost model + analysis tooling
  the operator wants.
