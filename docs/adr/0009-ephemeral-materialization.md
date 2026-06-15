---
adr: 0009
title: Content index — ephemeral per-tenant materialization (edge search, v1.2)
status: Accepted (rev 19)
slug: ephemeral-materialization
tags: [retrieval, indexing, custody]
---

# ADR-0009. Content index: ephemeral per-tenant materialization (edge search, v1.2)

## Context

A fleet-wide content index would be a durable copy of every user's notes — directly contrary to ADR-0001. But the agent/edge still need rich whole-corpus search at v1.2.

## Decision

**No persistent fleet-wide content index.** When edge search is needed, materialize per-tenant on demand: a **per-tenant Durable Object (SQLite), scale-to-zero, rebuild-on-wake**. SQLite-everywhere via the shared core (ADR-0011/0022). Tag vocabulary in KV. All derived/rebuildable.

**Scope (rev 19).** **Edge search enters v1 at v1.2** (with hosted inference, ADR-0020) — the agent/edge get rich whole-corpus **lexical** FTS + aggregation; **semantic/vectors stay deferred**.

## Consequences

Partitioning friction dissolves; cold tenants expose nothing; rebuild-on-wake means no freshness problem. The per-tenant DO is **Cloudflare-specific** — pulling it into v1.2 **deepens the one real Cloudflare lock-in** (ADR-0028); it stays a derivable/disposable adapter (rebuild-on-wake), distinct from the MCP transport (which stays DO-free via `createMcpHandler`). Persisted/vector stores are deferred — vectors + ids only, never raw bodies.
