---
adr: 0015
title: Write path — version-aware; atomicity and idempotency
status: Accepted (rev 6)
slug: write-path-atomicity-idempotency
tags: [write-path]
---

# ADR-0015. Write path: version-aware; atomicity and idempotency

## Context

Writes must be safe under retries (idempotent), safe under concurrent edits (SHA-conditional), and atomic across the note + source pair.

## Decision

**Idempotency:** a generated **ULID** id (+ optional client idempotency key).

**Mutations:** SHA-conditional updates; the write client is version-aware from day one; v1 exposes **creates + append + a bounded correction surface** (edit / undo / delete, ADR-0026); the bounded surface is **op-bounded, not time-bounded** (rev 25) — history-rewrite, CRDT/collab, and arbitrary in-file edit outside the API all stay gated.

**Atomicity:** note + source in one commit (Git Data API tree, or two Contents calls for v1 simplicity); delete/undo remove note (+ its source) in one commit.

**Divergence (clone-holder backend).** Non-fast-forward push is a **hard stop, never `force`**; the write client resolves via **fetch -> merge -> re-push** (ADR-0010). Treat the local commit and the remote push as separate, idempotent, **resumable** stages — on startup, reconcile any local commits ahead of the remote (re-attempt the push; never assume the last session finished). The HTTP Idempotency-Key discipline mirrors this on the device git path.

## Open

Tree vs two Contents calls; edit conflict-resolution policy (resolved ADR-0018 #10 — edge SHA-conditional, single-user-rare).
