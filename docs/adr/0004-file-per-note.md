---
adr: 0004
title: One file per note; editable in place via a version-aware path
status: Accepted (rev 4)
slug: file-per-note
tags: [storage, concurrency]
---

# ADR-0004. One file per note; editable in place via a version-aware path

## Context

The granularity of the on-disk unit shapes concurrency, audit, and the editing surface.

## Decision

**New file per note.** **Captures are creates** (conflict-free). v1 also exposes a **bounded mutation surface** (ADR-0026): **append** (a dated block to a note's timeline — near-conflict-free) and a **correction surface** — **edit / undo / delete** — for cleaning up erroneously submitted content. Mutations are **SHA-conditional updates** (ADR-0015); arbitrary/historical editing stays gated.

## Consequences

Conflict-freedom absolute for captures and near-absolute for appends; the correction surface is op-bounded (the five-op vocabulary, ADR-0026) and edge-mediated SHA-conditional, so single-writer conflict risk is ~zero at any age (412 → refetch → reapply works regardless of how long ago the note was captured; rev 25). Undo/delete are **new commits** — history preserves everything, so they tidy `HEAD` without rewriting the record (ADR-0007). **Rejected — daily-file consolidation.** Narrative docs stay single-file.
