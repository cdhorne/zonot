---
adr: 0026
title: Operation vocabulary & bounded mutation
status: Accepted (rev 14)
slug: operation-vocabulary
tags: [write-path, scope, data-model]
---

# ADR-0026. Operation vocabulary & bounded mutation

## Context

"Creates only" (ADR-0004/0015/0020) fit a reader wedge; the read/write bridge (ADR-0010/0025) and dogfooding need a way to add to and clean up content. The bound is **the op vocabulary itself** — five ops, no others — not time-recency.

## Decision

### v1 operation vocabulary

- **capture** — new note (create). Default; conflict-free.
- **append** — add a dated block to a note's append-only timeline (ADR-0005 body convention). Additive; near-conflict-free.
- **correct** — targeted SHA-conditional update of a note's compiled body (timeline preserved). Available **at any age**; the SHA-conditional 412 → refetch → reapply loop handles divergence at any age. Provenance trailer: `Edit-Of: <id>`.
- **undo / delete** — remove a note as a git delete-commit (note + its source in one commit) with an `Undo-Of`/`Delete-Of` trailer (ADR-0007). Both available at any age; the split is intent-signalling — `undo` = "this was a fumble" (pairs with the 4-second post-save snackbar, ADR-0034); `delete` = "this had its time, remove it". `undo` resolves the target by `capture_id`; `delete` by `id`.

### Why it's safe

All four mutation ops are **edge-mediated SHA-conditional** (412 → refetch → reapply), which sidesteps device-git divergence (ADR-0010) at any age. **Delete/undo don't violate observability — they *are* new commits**; history preserves everything (ADR-0007). The bright line: edit `HEAD` via the op vocabulary; never rewrite history, never collab/CRDT, never edit the file outside the API.

### Out of scope

History rewrite (force-push) stays gated; collaborative / real-time editing (no CRDT — single-writer, create-mostly); in-file edit outside the API surface (the convention envelope must be re-validated).

## Consequences

A complete, on-ethos dogfood loop (capture → append → correct → undo / delete) with no new conflict machinery. The conformance envelope (ADR-0011) is unchanged. The original "correction-only" positioning weakens: discipline ("big edits on desktop") is enforced by the maker, not the app.

## Evolution

- rev 14: dropped the 24h-ish recency window on `correct` and `undo`; SHA-conditional handles divergence at any age. The op vocabulary remains the bound.
