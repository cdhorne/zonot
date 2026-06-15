---
adr: 0007
title: Git history is the immutability guarantee; provenance in commit trailers
status: Accepted (rev 5)
slug: git-as-ledger
tags: [git, provenance]
---

# ADR-0007. Git history is the immutability guarantee; provenance in commit trailers

## Context

Audit and provenance need a home; an in-file array would duplicate what git already gives us for free and risk drift.

## Decision

The **git commit history is the append-only, immutable record**. **Force-push protection is a sensible default, not a hard gate.** **Provenance in a commit trailer on every write** (`Source`, `Capture-Id`/`Edit-Of`, `Model`, plus `Undo-Of`/`Delete-Of` for the correction surface, ADR-0026) — so even deletions are first-class, attributable events.

## Consequences

Per-note history meaningful. Read the file for current state, git for history. **Editing `HEAD` is expected; rewriting *history* (force-push) stays protected** — the bright line that makes undo/delete safe (you tidy the present, never erase the record).
