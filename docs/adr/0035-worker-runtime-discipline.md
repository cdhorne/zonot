---
adr: 0035
title: Worker runtime — error discipline, observability, multi-tenant scaffolding
status: Accepted (rev 1)
slug: worker-runtime-discipline
tags: [worker, observability, error-handling, multi-tenant]
---

# ADR-0035. Worker runtime: error discipline, observability, multi-tenant scaffolding

## Context

ADR-0013/0021/0022 give the Worker its surface but no spec for runtime mechanics — error discipline, ops observability, the readiness path from v1.0 single-user → v1.1 managed C1. Dogfood (ADR-0013) needs the Worker inspectable when something breaks; v1.1 can't afford a Worker rewrite. Companion: **[`docs/specs/worker-spec.md`](../specs/worker-spec.md)**.

## Decision

### Error discipline (universal RFC 9457)

Every error response is `application/problem+json` with a Zonot-namespaced `type` URI. Canonical taxonomy:

- `https://zonot.app/problems/sha-conflict` → 412 (caller refetches + reapplies; ADR-0026)
- `https://zonot.app/problems/idempotency-replay` → 422 (different body for same key; 24h cache)
- `https://zonot.app/problems/uninitialized` → 409
- `https://zonot.app/problems/not-found` → 404
- `https://zonot.app/problems/unauthorized` → 401
- `https://zonot.app/problems/rate-limited` → 429 + `Retry-After` + `retryable: true`
- `https://zonot.app/problems/upstream-rate-limited` → 429 (GitHub's quota echoed; `retryable: true`)
- `https://zonot.app/problems/upstream-down` → 502 (GitHub 5xx; `retryable: true`)
- `https://zonot.app/problems/validation` → 400 (field-level errors in the `errors` extension)
- `https://zonot.app/problems/internal` → 500 (logged with `trace_id`)

Every response carries a **`zonot-trace-id` header** (ULID); error bodies echo it in a `trace_id` extension. **No second error tier** — no plain text, no bespoke shapes; uniform across MCP and HTTP.

### Observability (no operator content telemetry; Sentry from v1.0 for ops)

- **Logs:** structured JSON (Logpush in prod; `wrangler tail` in dev). One entry per request: `ts, trace_id, workspace_hash, op, status, latency_ms, upstream_status, upstream_ms, error_type`. **No body content, no titles, no tags, no PII.**
- **Metrics:** Workers Analytics Engine. Counts + latency histograms keyed on `(op, status)`. Per-tenant breakouts (hashed workspace id) at v1.1.
- **Sentry from v1.0.** Operator-side crash + uncaught-error reporting. **Errors only — no body content, no breadcrumbs containing user data.** ADR-0001 governs *content*, not ops health; conflating the two costs invisible crashes the solo dogfood maker can't see. Client-side Sentry is a separate decision at the app/CLI layer (deferred).
- **No third-party content telemetry** (PostHog, Mixpanel). The line is ops vs. content.

### Multi-tenant scaffolding from v1.0

Every request carries an explicit `workspace` param even at v1.0 single-tenant; the Worker resolves it first. No "default tenant" shortcut. **Workspace resolution:** v1.0 = in-memory `Map<workspace, { repo, pat }>` from secrets; v1.1 = entitlement-store lookup (KV-cached, refreshed on push) keyed on the OAuth account → repo + minted token. Same call site; different backend. A **per-`(workspace_hash, op)` rate limiter** binding ships at v1.0 with trivial limits; v1.1 enforces real limits per entitlement tier. **No shared mutable state** across workspaces. v1.2's per-tenant edge-search Durable Object is namespaced per workspace (ADR-0009).

### Cold-start + caching budget

Workers cold start ~5-20 ms — not the issue. The **GitHub REST round-trip dominates** (Contents ~300–800 ms; Git Data tree ~500–1500 ms); the ADR-0034 `save → ack p50 ≤ 1.2 s` budget is honest given this. The Worker uses `caches.default` + KV with short TTL + stale-while-revalidate for tag vocab, workspace metadata, entitlement state — staleness safe only where stated; never for SHA-conditional reads.

## Consequences

Phase 1 is scopable as discrete tasks: error-mapping middleware, observability + Sentry wiring, workspace dispatcher + rate limiter scaffold, GitHub REST backend with trace propagation. v1.0 → v1.1 is a backend swap behind a stable dispatcher interface. The operator gets ops visibility from day 1 without ever holding user content.

## Open

Sentry sample rate at v1.0 (probably 100% errors, 0% transactions until traffic is real); client-side Sentry policy; operator-side SLO/dashboarding for v1.1+.
