# Managed tier spec (v1.1) — open/closed split, entitlement, auth, custody, onboarding, billing

> **Companion to [ADR-0017](../adr/0017-custody-tiers-auth-distribution.md) and
> [ADR-0033](../adr/0033-billing-and-entitlement.md)** (with
> [ADR-0027](../adr/0027-longevity-and-revenue.md) §Mechanism and
> [ADR-0037](../adr/0037-threat-model.md) as constraints). This document is the implementation
> contract for **v1.1 — managed C1** (the first paid tier). It is **hand-authored**. When an ADR
> and this spec disagree, the ADR wins and this file should be fixed.

## 0. Scope

What this spec pins:

1. The **open/closed repo split** — which v1.1 parts live in this public repo vs. the private
   control plane.
2. The **entitlement store contract** — record shape, KV layout, readers/writers, lifecycle.
3. The **auth architecture** — OAuth 2.1 + CIMD on the MCP surface; the Worker as resource
   server; auth-mode selection for self-host vs. managed.
4. The **GitHub App custody path** — per-request installation-token minting, the key ceremony.
5. The **onboarding flow** — OAuth in → auto-repo → App install, with partial-failure recovery
   (closes ADR-0017 §Open item 2).
6. The **billing app rail** — IAP receipt validation + store notifications → entitlement.
7. The **v1.0 → v1.1 transition** implementation notes (extends worker-spec §3.4).
8. The **task breakdown** (Phase 4) with open/closed placement.

What this spec deliberately does NOT cover:

- **Hosted inference** (Tier 2) and the **edge-search DO** — v1.2 (ADR-0002/0009/0027; provider
  choice blocked on ADR-0037 §Provider stack).
- The **web/CLI payment rail** — deferred until web paid-demand appears (ADR-0033 / ADR-0018 #11).
- The **licensing instrument** (FSL vs BSL) — confirmed at first release (ADR-0027 §Mechanism).
- Mobile **paywall/upgrade UX detail** — lands as a mobile-spec §rev when v1.1(f) is scoped.

## 1. The open/closed split

ADR-0027 §Mechanism: the product is open and self-hostable; **the managed layer — multi-tenant
control plane, billing, custody orchestration — is closed/private (never released).** This repo
is public, so the split is a *repo boundary*, not a directory boundary.

### 1.1 What lives in this repo (open)

- The **self-hostable Worker** — including every v1.1 *seam*: the workspace-resolver interface,
  the entitlement-store read interface + KV reader, the token-provider interface, and the
  resource-server auth middleware. A self-hoster runs path-secret auth + static PAT forever
  (that *is* C0); the seams default to the v1.0 implementations.
- **Generic GitHub App token minting** — App JWT → installation access token is standard GitHub
  auth, useful to a self-hoster who prefers an App over a PAT. The code is open; the *managed
  App's private key* is operator-side config, never in any repo.
- The **mobile app** — including the IAP client and the OAuth sign-in UX (the client half of
  auth is not a secret).
- This spec, the schemas, and the conformance surface.

### 1.2 What lives in the private control-plane repo (closed)

One private repo (working name `zonot-managed`; final name/org is an operator decision — task
4(g)). It **consumes** `@zonot/core` and the open Worker; it never forks them.

- The **OAuth 2.1 authorization server** wiring (issuance, refresh rotation, CIMD client
  registration) and the account store (Zonot account = OAuth/GitHub identity, ADR-0017).
- The **onboarding web flow** (§5) and its GitHub App install orchestration.
- The **billing adapters** — IAP receipt validation + store server-notification consumers
  (reusing Fathom's RevenueCat-replacement backend), writing the entitlement store (§2).
- **Deployment config** for the managed Worker (wrangler env, KV namespaces, the App private
  key, prod Sentry DSN, Logpush→R2) and the **ops runbook** (workspace-hashing rule, 7-day
  Logpush retention, "don't read your own logs" — ADR-0037 §Mitigations).

**Bright line (ADR-0037):** billing data and corpus data never share a system. The control plane
holds entitlement + receipts + account identity; it never holds note content and never gets a
GitHub token scope beyond what onboarding needs.

## 2. Entitlement store contract

Server-authoritative, keyed to the **Zonot account**, not a store transaction (ADR-0033). It is
derivable, disposable state — losing it costs convenience, never data.

### 2.1 Record shape

```jsonc
// KV key: entitlement:<workspace>   (the Worker's per-request read path)
// Written by billing adapters (closed); read by the Worker (open interface).
{
  "v": 1,
  "account_id": "gh:1234567",        // Zonot account (OAuth/GitHub identity)
  "workspace": "chris-notes",
  "active": true,                    // C1 active flag
  "tier": "c1",                      // "c1" (BYO-model) | "c1-inference" (v1.2, opt-in SKU cap)
  "valid_until": "2026-08-01T00:00:00Z",
  "grace_until": null,               // store/PSP grace window end, if in billing-retry
  "source": "apple-iap",             // adapter that last wrote this record (audit, not logic)
  "github": {
    "installation_id": 87654321,     // GitHub App installation for token minting
    "owner": "chris",
    "repo": "notes",
    "branch": "main"
  }
}
```

- **ISO-8601 UTC strings** for all timestamps; **`v: 1`** with a forward-migration hook,
  mirroring the convention-versioning discipline (ADR-0012).
- `active` flips false only at **final expiry** (after grace) or **refund effective time**
  (ADR-0033 §Lifecycle). The Worker treats `active && now < max(valid_until, grace_until)` as
  entitled; the *writer* owns lifecycle transitions, the reader stays dumb.
- A second index `account:<account_id>` → workspace list lives control-plane-side only; the
  Worker never needs it.

### 2.2 Read path (open Worker)

- KV read `entitlement:<workspace>`, cached 60s stale-while-revalidate (worker-spec §4.1).
- Resolution failure modes map to the existing taxonomy: unknown workspace → 404, inactive
  entitlement → 403 `problems/entitlement-inactive` (RFC 9457), bad token → 401. Timing
  discipline matches the v1.0 dispatch (constant-time, indistinguishable unknown/bad).
- **Never cache the GitHub installation token in KV** — minted per request (§4), held in memory
  for the request lifetime only.

### 2.3 Write path (closed control plane)

Only billing adapters and onboarding write entitlement. Every write is full-record replace
(records are small; last-writer-wins is safe because each workspace has one billing identity).
Store notifications (App Store Server Notifications v2, Play RTDN) drive renewals / cancels /
refunds / billing-retry automatically; no cron reconciliation in v1.1 beyond the stores' own
retry semantics.

## 3. Auth architecture

### 3.1 Two auth modes, one Worker

The Worker gains an **auth-mode switch** (env-driven, per deployment):

| Mode | Who | Credential | Workspace resolution |
|---|---|---|---|
| `path-secret` (default) | v1.0 dogfood, C0 self-host | path-secret in URL + static map | `WORKSPACE_MAP_JSON` (existing) |
| `oauth` | managed C1 | Bearer access token (≤1h) | token → account → entitlement KV |

Self-host never requires the OAuth stack; the managed deployment never accepts path-secrets.
Both modes converge on the same `WorkspaceContext` — no handler changes (worker-spec §3.4:
"every row is a config / backend swap").

### 3.2 MCP auth (managed mode)

Per ADR-0017/0022, idiomatic all the way down:

- **OAuth 2.1** with refresh-token rotation (single-use refresh; 1h access / 30d-idle-90d-max
  refresh — ADR-0037 rotation table).
- **CIMD** (client ID metadata documents) for client identity; **DCR as deprecated fallback**.
- **RFC 9728** protected-resource metadata served by the Worker at
  `/.well-known/oauth-protected-resource`, pointing at the control-plane AS.
- **RFC 8707** resource indicators; **no token passthrough** — the GitHub token never leaves
  the Worker, and the OAuth token never reaches GitHub.
- Transport stays Streamable HTTP, stateless, DO-free (the Phase 1 transport is untouched).

### 3.3 Token validation (open Worker)

The Worker validates Bearer tokens as a **resource server**: JWT access tokens signed by the AS
(JWKS fetched + cached 5 min, SWR), `aud` checked per RFC 8707, `sub` = account_id → entitlement
lookup. Validation code is open (a self-hoster could point it at their own AS); the AS itself is
closed (§1.2).

## 4. GitHub App custody

- App scope: **Contents: read-write + Metadata: read-only**, installed on **only the one notes
  repo** (ADR-0017). Repo lives in the *user's* GitHub account.
- Per request: mint App JWT (RS256, ≤10 min) → `POST /app/installations/{id}/access_tokens` →
  installation token (≤1h), request-lifetime only. Minting adds one GitHub round-trip; it rides
  the same budget as the dominant GitHub REST cost (worker-spec §4.2) — measure in 4(b), and if
  p99 suffers, an in-isolate (never KV) memo of the installation token for its remaining
  lifetime is the sanctioned optimization.
- The **App private key is the sole durable operator secret** (ADR-0037 §Bright lines). Rotation:
  annual or on compromise, new key via GitHub UI, deploy, 24h overlap window.
- The v1.0 `WorkspaceResolution.token` (static PAT) becomes one `TokenProvider` implementation;
  App minting is the second. Interface in the open Worker; the managed deployment selects by
  auth mode.

## 5. Onboarding (closed, control plane)

The wrapper (ADR-0017): **OAuth in → one App-install click on an auto-created repo → per-user
config written.** Steps, each idempotent and individually resumable:

1. **OAuth sign-in** → Zonot account exists (GitHub identity).
2. **Repo creation** (user-owned, private by default) — skip if the user picks an existing repo;
   apply repo defaults: **force-push protection on the default branch** (the history-rewrite
   gate, ADR-0004/0026), default branch `main`.
3. **App install** on exactly that repo (GitHub App install URL with `repository_ids` pinned);
   callback records `installation_id`.
4. **Convention init** — call the Worker's existing `init` (scaffold `notes/` + `sources/`,
   convention version, vocab) through the App token.
5. **Entitlement write** (trial or post-purchase state per the billing flow) + per-user config.

**Partial-failure recovery (closes ADR-0017 §Open):** the onboarding record carries a step
cursor; every step is safe to re-run (create-if-absent, install-if-absent, init is already
idempotent). Resume = re-enter the flow, fast-forward completed steps. Abandonment leaves no
operator-side custody: an installed-but-never-entitled App is inert and uninstallable by the
user at GitHub; a created repo is the user's own.

## 6. Billing — the app rail (v1.1)

Per ADR-0033, IAP-first; the web/CLI rail is deferred and additive.

- **Client:** StoreKit 2 / Play Billing in the app; one SKU (C1 subscription, ~$2–5 CAD).
  Purchase → receipt/transaction to the control plane.
- **Server:** reuse **Fathom's RevenueCat-replacement backend** for receipt validation + store
  server notifications (ASSNv2 / RTDN). Its output is exactly one thing: entitlement-store
  writes (§2.3). The rest of the system never sees the payment source.
- **Lifecycle:** store-native grace (~16d) honored via `grace_until`; refund revokes at the
  refund's effective time; chargebacks flag operationally (ADR-0033 §Lifecycle).
- **Guardrails:** billing data never touches the user's repo; capture never blocks on billing
  state *within* an active entitlement (the v1.2 cap degrades enrichment, never capture).

## 7. v1.0 → v1.1 transition — implementation notes

Extends worker-spec §3.4. Concrete swap points, all existing:

| Swap | v1.0 (exists) | v1.1 | Where |
|---|---|---|---|
| Workspace resolution | `resolveWorkspace` (static map) | entitlement-backed resolver | `apps/worker/src/workspace.ts` (the documented swap point) |
| GitHub auth | `WorkspaceResolution.token` PAT | `TokenProvider` → App-minted token | `apps/worker/src/github-token.ts` (seam, 4(a)) |
| Request auth | path-secret dispatch | Bearer validation → account → entitlement | auth-mode switch (§3.1) |
| Rate limit key | workspace | per-tier from entitlement | `ratelimit.ts` (key derivation only) |
| Logging | `wrangler tail` | + Logpush→R2, 7-day retention | closed deploy config |
| Sentry | dev DSN | prod DSN, same wiring | closed deploy config |

## 8. Task breakdown (Phase 4)

| Task | What | Where | Scope | Blocked on |
|---|---|---|---|---|
| 4(a) | Entitlement schema + store interface + KV reader + workspace-resolver/token-provider seams, v1.0 impls, tests | open (worker) | M | — |
| 4(b) | GitHub App token minting (App JWT → installation token) + key-rotation overlap support | open (worker) | M | — |
| 4(c) | Resource-server auth: Bearer validation (JWKS/SWR), RFC 9728 PRM endpoint, RFC 8707 `aud`, auth-mode switch | open (worker) | L | 4(g) AS shape |
| 4(d) | Onboarding flow with step-cursor resumability (§5) | closed | L | 4(g) |
| 4(e) | Billing app rail: receipt validation + ASSNv2/RTDN → entitlement writes (Fathom backend reuse) | closed | L | 4(g) |
| 4(f) | Mobile: IAP client, sign-in (OAuth) UX, upgrade surface; auth-mode-aware edge client | open (mobile) | L | 4(c), 4(e) |
| 4(g) | Stand up the private control-plane repo: scaffold, AS wiring, deploy config, ops runbook | closed | M | operator (repo/name/accounts) |
| 4(h) | Ops cutover: Logpush→R2, prod Sentry DSN, entitlement KV namespace, dashboards | closed | S | 4(g) |

Exit (ROADMAP): **a stranger can sign up, connect their repo, and capture via their own Claude —
paying ~$2–5 CAD.** First external validation + revenue.

## 9. Open items

- **Control-plane AS build-vs-port** — implement OAuth 2.1 directly vs. port an edge-native AS
  library; decided at 4(g) scoping. (The Worker-side validation contract in §3.3 is stable
  either way.)
- **Trial policy** — whether onboarding grants a time-boxed trial entitlement before purchase;
  product call, decide before 4(d) ships.
- **Store commercial terms verification** — 15% SBP cut + tax handling re-verified at 4(e) build
  (ADR-0033's own caveat).
- **Directory submission** (MCP registry etc.) — post-v1.1 distribution follow-through
  (ADR-0017 §Open).
