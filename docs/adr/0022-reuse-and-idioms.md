---
adr: 0022
title: Maximal code & protocol reuse; idiomatic boundaries
status: Accepted (rev 14)
slug: reuse-and-idioms
tags: [architecture, code, protocol]
---

# ADR-0022. Maximal code & protocol reuse; idiomatic boundaries

## Context

Maximize reuse across the stack; speak the ecosystem's idioms at every boundary rather than inventing.

## Decision

1. **One core, three runtimes** (ADR-0011): convention/normalization, frontmatter, slug/id, tag normalization, migrations, the write client, and the FTS engine all live in the shared core and run in the Worker, the CLI, and the app.
2. **One handler set, two transports:** capture/read logic is written once as core functions; the **MCP tools** and the **app's HTTP endpoints** are thin adapters over them. The handlers are origin- and trigger-agnostic — importers, schedulers, and agent hooks are additional callers (ADR-0029/0030).
3. **One schema, many uses:** define the convention and tool I/O once (TS schema emitting JSON Schema); reuse for MCP `inputSchema`/`outputSchema`, HTTP request validation, frontmatter validation, and the conformance test.
4. **One write-client interface, two backends:** **GitHub REST** (Contents / Git Data API) for the **stateless edge** (no clone), and **isomorphic-git** for **clone-holders** (CLI, app). Same interface; the runtime picks the backend.
5. **Git as the device sync protocol:** the app uses isomorphic-git to fetch/pull/push, reusing git's delta protocol and gaining local history — no bespoke changes-feed/cursor (ADR-0010). Pure-JS is viable at our scale; native libgit2 is a benchmark-gated fallback (ADR-0018 #3).
6. **Idiomatic standard protocols at each boundary:** **MCP** (agent, spec `2025-11-25`), **HTTP + RFC 9457 + Idempotency-Key + cursor** (app/integrators), **git** (storage + device sync), **OAuth 2.1 / CIMD** (auth, v1.1). No bespoke protocols. (Idempotency-Key is an expired IETF draft + Stripe convention — idiomatic, not ratified.)
7. **Distributed-but-identical vocab:** tag normalization (core) runs over a vocab in KV on the edge and a synced copy on the device, so every capture path normalizes the same way.

### Concrete port choices

Most of the stack is ported; the genuine build is the convention core + two thin seams.

1. **MCP:** port `@modelcontextprotocol/sdk` + Cloudflare **`createMcpHandler`** (stateless, no Durable Object — stays inside ADR-0020); write only tool handlers + the shared Zod schemas. Avoid `McpAgent` (pulls in DOs).
2. **Frontmatter:** port the dependency-free **`yaml`** (eemeli); build the ~20-line `---` splitter in core. Avoid `gray-matter` (Node `Buffer` deps break workerd/RN).
3. **FTS:** `bun:sqlite` (FTS5 default) on the CLI, `op-sqlite` (FTS5 flag) on the app; edge search at v1.2 (ADR-0009). Build one shared FTS5 schema + query layer (with frontmatter facet columns for aggregation, ADR-0008); inject the driver per runtime.
4. **Conventions:** adopt Obsidian properties + the GBrain compiled-truth/timeline body shape (ADR-0005), keeping Zonot's ULID id.
5. **Desktop:** build no desktop UI — Obsidian + obsidian-git + Dataview/Datacore + Omnisearch *is* the desktop surface; Zonot's own app exists because obsidian-git is unstable on mobile.

**The genuine build:** the convention/conformance envelope (ADR-0011/0012), the shared FTS layer, and the version-aware write-client interface. Everything around them is off-the-shelf.

### `WriteClient` interface

Concretizes "one interface, two backends". Named ops: `init`, `capture`, `append`, `correct`, `undo`, `delete`, `readNote`, `head`. Two implementations:

- **`GitHubRestBackend`** (Worker; stateless; Contents API for the v1 simple path, Git Data tree for atomic note+source commits — ADR-0015).
- **`IsomorphicGitBackend`** (CLI/app; clone-holder; commit + push with fetch→merge→re-push on non-FF — never `force`, ADR-0015).

All inputs flow through the **core normalization pipeline** (tag-norm, slug-derive, frontmatter-key-order, body-splitter validation, ULID generation when absent) **before** the backend sees them — the backend transports bytes, it does not shape them. **Provenance trailers are core-generated** (`Source`, `Capture-Id` / `Edit-Of` / `Undo-Of` / `Delete-Of`, `Model` — ADR-0007); the backend only appends the trailer block to the commit message.

**Error contract:** SHA-conditional collisions throw a typed `SHAConflictError { sha_expected, sha_actual, path }`; the Worker transport maps to HTTP 412 or 422 (idempotency-replay with different body) + RFC 9457 (ADR-0021).

**Idempotency:** caller-supplied `idempotency_key` indexes a 24h-retention cache keyed on `(workspace, key)`; same body → cached `WriteResult`; different body → `SHAConflictError`. Full TypeScript signatures in **[`docs/specs/core-spec.md`](../specs/core-spec.md)**.

## Consequences

Less code, fewer drift surfaces, and every boundary is something readers (Obsidian), clients (MCP hosts), and integrators (HTTP/git) already speak. The conformance test (ADR-0011) guards the one place reuse must be exact: the convention envelope.
