---
adr: 0031
title: Extension architecture — a closed kernel + typed extension points
status: Accepted (rev 18)
slug: extension-architecture
tags: [architecture, code, extensibility]
---

# ADR-0031. Extension architecture: a closed kernel + typed extension points

## Context

Zonot grows along several adapter surfaces — write backends, SQLite drivers, transports, capture triggers, importers, connectors, model providers. Name the architecture once so every future extension lands the same way.

## Decision

**Closed kernel, open edges.** The core is a small, closed, conformance-guarded kernel (convention/envelope, schema, FTS+facet layer, write-client interface, handler set). Everything that legitimately varies is a **named extension point**: a typed interface the runtime or agent injects an adapter into. **The kernel never depends on a concrete adapter.**

### The extension points (catalogue)

1. **Write-client backend** — GitHub REST | isomorphic-git | (future GitLab/Gitea) (ADR-0022).
2. **SQLite driver** — `bun:sqlite` | `op-sqlite` | wasm (ADR-0011).
3. **Transport** — MCP | HTTP | (future), over one handler set (ADR-0021/0022).
4. **Capture caller / trigger** — CLI | agent hook | scheduler | mobile; handlers are origin/trigger-agnostic (ADR-0030).
5. **Format importer** — GBrain | vendor-memory | logbook | markdown; convention→convention (ADR-0029).
6. **Corroboration connector** — GitHub | tickets | calendar; client/agent-side, optional (ADR-0029).
7. **Enrichment model provider** — BYO-client-model | Workers AI | no-retention API; Tier-2 guardrailed (ADR-0002/0027). **v1.2 ships one adapter (Workers AI); BYO is the agent harness (Tier 1) — no user-facing provider config.** Per-activity routing, Bedrock, OpenRouter, own-hardware are future adapters.
8. **Tag vocabulary** — the distributed-but-identical vocab (ADR-0022).
9. **Frontmatter open-extension** — tolerant pass-through of unknown keys (ADR-0005).

### The extension contract (non-negotiable)

Every extension:

- (a) is an **adapter over a typed core interface** — the kernel never imports it;
- (b) **never mutates the convention envelope** (the conformance test guards it, ADR-0011);
- (c) **emits provenance** — every write carries a commit trailer naming the importer/model/connector (ADR-0007);
- (d) is **optional** — absence degrades gracefully;
- (e) keeps the operator a **processor, not a store** (connectors/inference are client/agent-side or no-retention, ADR-0029/0027);
- (f) keeps **vendor/runtime specifics in the adapter, never the kernel** (web-standard core, ADR-0028);
- (g) is **versioned** where it touches the convention (ADR-0012).

### Example surfaces (post-MVP, not v1)

The isomorphic core + origin/trigger-agnostic handlers make new capture surfaces thin clients over the same edge: a **browser extension** (capture any page → note, URL as `source`), **email-in** (Cloudflare Email Workers; forward → note), a **VS Code extension**. *Electron is skipped — Obsidian is the desktop (ADR-0022).* These are reach (validating the architecture), not new scope.

## Consequences

Growth happens at the edges without bloating the kernel or weakening the ethos; the conformance test + the contract are the guardrails. The genuine build (ADR-0022) is the kernel + the interfaces; adapters accrue over time, many of them ported.
