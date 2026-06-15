---
adr: 0021
title: Tool & sync contract (MVP)
status: Proposed (shapes ready to confirm)
slug: tool-and-sync-contract
tags: [api, mcp, app]
---

# ADR-0021. Tool & sync contract (MVP)

## Context

The agent (MCP) and the app (HTTP) need a stable contract over the same core; the question is whose protocol shape wins and where idempotency/error live.

## Decision

- **Transports over one core (ADR-0022).** The MCP tools (Claude) and the app's HTTP endpoints are thin transports over the same core handlers — capture/read logic is written once.
- **Tool conventions (MCP).** Each tool = name + description + JSON Schema `inputSchema` + `outputSchema`; return `structuredContent` plus a serialized-JSON text fallback (spec SHOULD); use `isError`. Pin spec revision **`2025-11-25`**.
- **Write.**
  - `capture_enriched(workspace, output{title?, tags[], type, body}, raw?, thread?, idempotency_key?)` → `{id, path, url, applied_tags[]}`. Client pre-enriched (Tier 1); edge normalizes tags and commits the note (+ source when `raw` present and distinct).
  - **App/CLI quick-capture** uses the same endpoint with a minimal output (format-only, Tier 0).
  - **Correction surface** (ADR-0026): `append(workspace, id, block)`; `correct(workspace, id, output, base_sha)`; `delete(workspace, id, reason?)` / `undo(workspace, capture_id)` — edge-mediated, SHA-conditional, delete/undo remove the note (+ its source) in one commit with `Undo-Of`/`Delete-Of` trailer (ADR-0007).
- **Read.** `list_recent(workspace, since?, limit=20)`; `read_note(workspace, id, include_source=false)`; `list_tags(workspace)`; `list_workspaces()`; `list(workspace, group_by?, filter?, cursor?)` — the faceted grouping tool (ADR-0008). *Edge: coarse + bounded + GitHub-backed at v1.0/1.1; index-backed and rich at v1.2 (ADR-0009).*
- **Conventions.** Errors → **RFC 9457 Problem Details** (`application/problem+json`; `type/title/status/detail` + a `retryable` extension, paired with a standard `Retry-After` header). Idempotency → **Idempotency-Key** (Stripe semantics; the IETF header is an expired draft, not ratified). On a key replayed with a *different* body, return **422 + Problem Details**; 24h retention default. Pagination → opaque **cursor**.
- **App sync.** Via **git** (ADR-0010/0022), not a bespoke API; v1 reads+writes ride a simple HTTP path through the edge (device git-sync is the C0 / post-MVP upgrade).
- **Init.** One-time scaffold (CLI `init` or edge bootstrap): create `notes/` + `sources/`, write the convention version, seed an empty KV vocab, store the PAT + path-secret (Phase 1).

## Open

Final field names/shapes.
