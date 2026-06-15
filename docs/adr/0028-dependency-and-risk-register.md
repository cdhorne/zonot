---
adr: 0028
title: Dependency & risk register
status: Accepted (rev 19)
slug: dependency-and-risk-register
tags: [risk, architecture, tracking]
---

# ADR-0028. Dependency & risk register

## Context

Make the dependency posture explicit: where Zonot leans hard, where it sits on a clean swappable seam, and where a provider's change of shape/stance/support is genuinely un-work-around-able.

## Decision

### The map

- **Lean hard, clean exit:** **GitHub as data store** (plain MD in your repo → move to GitLab/Gitea/self-host anytime; the ethos *is* the exit). **Cloudflare Workers** (core is web-standard → portable to Deno/Bun/Node edge; KV swappable; `createMcpHandler` has a vendor-neutral transport fallback). **Expo/RN** (the app shell is RN-specific, but the shared core survives a shell rewrite).
- **Clean integration points (swappable):** **MCP** (one-handler-set / two-transports → MCP is an adapter; HTTP carries the same core). **Claude / enrichment model** (model-agnostic; data is model-independent). **SQLite / op-sqlite / bun:sqlite** (FTS5 is standard; portable SQL behind a driver interface). **Obsidian** (file-convention compatibility, not an API dependency). **Bun** (dev toolchain only; prod is workerd).
- **External knob you can't remove (slows you only):** **GitHub API rate limits** (ADR-0019) — mitigate by being frugal.
- **Corroboration connectors (post-MVP, ADR-0029):** **GitHub history reuses the existing GitHub auth** — zero new dependency. **Tickets (Jira/Linear) and calendar (Google/Outlook)** are net-new, swappable connectors — keep them client-side/agent-driven (Tier 1) and optional.

### The two genuine risks

1. **isomorphic-git on mobile at scale (post-MVP).** No maintained native-git RN module exists, and isomorphic-git has documented packfile-bloat (#2017) in exactly the fetch → merge → re-push loop. If perf doesn't hold, the only escape is a multi-week native-binding build (gitoxide / libgit2 via uniffi / Nitro). *Mitigation:* deferred to post-MVP, benchmark-gated (ADR-0018 #3), edge path is a permanent fallback.
2. **Cloudflare lock-in via discipline erosion** (self-inflicted). Cloudflare changing terms is only un-work-around-able if Cloudflare-specific APIs (Durable Objects, proprietary bindings) have leaked into the core. *Mitigation:* keep the core web-standard; Cloudflare specifics live in a thin adapter (use `createMcpHandler`, not `McpAgent`/DOs, ADR-0022). **Two soft gravity wells:** **Workers AI** (v1.2 hosted inference) is Cloudflare-specific but sits behind the model-provider extension point (ADR-0031), so swappable at bounded cost; **Durable Objects** — the per-tenant edge-search index (ADR-0009) enters v1.2, so this lock-in deepens (the stickiest Cloudflare piece). Accepted for the rich managed tier; the index stays derivable/disposable, and the MCP transport stays DO-free.

### Guardrails promoted to non-negotiable

- (a) **Core stays web-standard; vendor/runtime specifics live in adapters.**
- (b) **The isomorphic-git mobile benchmark is a gating spike before any device-git-sync work.**

## Consequences

The ownership ethos keeps the genuine-risk bucket nearly empty by design; the two exceptions are deferred and pre-mitigated. Watch-list items live in ADR-0025.
