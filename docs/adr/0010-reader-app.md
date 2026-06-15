---
adr: 0010
title: The mobile app — a connected local-first read/write bridge (MVP wedge)
status: Accepted (rev 13)
slug: reader-app
tags: [app, offline, retrieval]
---

# ADR-0010. The mobile app: a connected local-first read/write bridge (MVP wedge)

## Context

The mobile surface is the differentiated front door for the dual-audience wedge (ADR-0025); how big a surface must it carry and how does it sync?

## Decision

The mobile app is the **differentiated surface**: a connected, local-first **read/write** client that bridges on-the-go capture/reading with the desktop-centric, git-native, agent-enriched workflow (Obsidian / Claude / CLI / grep). The desktop is the workshop (reused), the phone is the front door. Still *not* a full editor or knowledge graph.

### MVP surface

- **Core screens:** capture, browse/search, read, and a bounded correction surface (edit / undo / delete, ADR-0026).
- **Offline-first:** a **local mirror (clone)** + a **local capture queue**.
- **Lexical/FTS search on-device** (op-sqlite, model-free) over the mirror (ADR-0008/0009).
- **Writes ride the edge in v1.** App writes (capture/append/correct/undo/delete) go through the Worker over HTTP, so edits are **edge-mediated SHA-conditional** (412 → refetch → reapply, not a device git merge); enriched capture comes from Claude/MCP, quick-capture is Tier-0-style.
- **Stack:** native Expo React Native, reusing Fathom's local-first (op-sqlite) patterns.

### Sync (post-MVP git path; v1 rides the edge — ADR-0022)

The app holds a clone and uses **isomorphic-git** (pure-JS, no native deps) to fetch/pull/push — reusing git's delta protocol and gaining local history, which removes any bespoke changes-feed (git fetch *is* the delta).

- **Viable in pure-JS at our scale.** The repo is tens of thousands of tiny, mostly-additive Markdown files and the device needs no history: **shallow clone (`depth: 1`)** is the only heavy op (seed from an edge-served tarball if it drags); pulls/pushes move small deltas. The packfile-reparse perf trap is avoided by the narrow git surface (clone once, then add/commit/push) and `statusMatrix` + `cache` if status is ever needed.
- **RN is not browser-CORS-bound**, so the app talks to GitHub directly (`http/web` client); the edge Worker is only a fallback proxy. The LightningFS "flush or corrupt" warning is browser-only — RN uses a real-fs adapter — but still ensure durable write ordering and treat the capture queue as source of truth until push confirms.
- **Native fallback:** libgit2 via a Nitro/Turbo module — gated on a benchmark (ADR-0018 #3), not the default; would cost platform-specific builds and break the core's pure-isomorphic-TS property.
- **MVP:** may sync HTTP-over-edge to keep v1 simple; the git path is the C0 / post-MVP sync (app pushes directly with the user's credential).
- **Divergence policy (non-negotiable; device git-sync path).** A non-fast-forward push is a hard stop, never an overwrite — `force` is forbidden on the write path (the trust-breaking bug every git-backed notes app hits). The write client runs a **fetch → merge → re-push loop** as a first-class operation; concurrent creates merge trivially (disjoint files). On same-note edit collision, **write the loser as a conflict-copy note** rather than `<<<<<<<` markers or silent last-write-wins. Keep device/app state out of the synced tree. ULIDs — not wall-clock timestamps — are the identity/ordering key. Store the GitHub credential in the platform secure store, scoped to the one workspace repo.

### Deferred to post-MVP

On-device embedding + enrichment models (the operator-free node); C0 direct git sync. **Not deferred:** on-device lexical FTS + faceted aggregation, the local mirror/clone + capture queue — model-free, in v1. Until on-device enrichment ships, the no-agent app user's enrichment comes from Tier-2 hosted inference (ADR-0002/0027); on-device enrichment is its eventual operator-free replacement.

## Consequences

A connected mobile read/write bridge without bundling models — a small but complete surface for the dogfood loop. The model-powered, operator-free, git-syncing app is the post-MVP differentiator (the C0 ownership upgrade).
