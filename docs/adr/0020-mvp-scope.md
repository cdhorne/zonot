---
adr: 0020
title: MVP scope (Phase 1, v1)
status: Accepted (rev 6)
slug: mvp-scope
tags: [scope, phasing]
---

# ADR-0020. MVP scope (Phase 1, v1)

## Context

Scope discipline is the load-bearing constraint for actually shipping; the v1 line decides what we *don't* build.

## Decision

**In v1, sequenced (rev 17).**

- **v1.0 — dogfood loop:** shared core (capture + append + bounded correction, ADR-0026); **CLI** (Tier 0); **Edge Worker** tool surface (ADR-0021); **mobile read/write bridge** (ADR-0010); GitHub writes via the edge; basic tag normalization; one-time repo init; read/search + **light faceted aggregation** (ADR-0008); a **minimal bulk importer** (ADR-0029). Single-user (path-secret + your PAT, ADR-0013).
- **v1.1 — managed C1:** multi-tenant **managed custody** — OAuth 2.1 + GitHub App + billing (ADR-0017); the first **paid tier** (BYO-model), ~$2–5 CAD (ADR-0027).
- **v1.2 — rich managed tier (C1):** **guardrailed Tier-2 hosted inference** (opt-in, no-retention, output-observable, small-model + capped; ADR-0002/0019/0027) **+ edge search** — the per-tenant materialized lexical FTS + aggregation index (ADR-0009), giving the agent/edge rich whole-corpus search.

**Deferred (post-v1).** On-*device* enrichment models; **arbitrary/historical edit** (the *bounded* correction surface is in v1); **semantic / vector search** (lexical edge search is in at v1.2); **device git-sync (C0)**; **format importers + corroboration connectors** (ADR-0029); **rich/custom aggregations** (ADR-0008).

## Consequences

v1 now spans **dogfood → paid managed product → hosted-inference convenience**, sequenced so each step ships and validates. This is **consciously larger than a dogfood-only MVP** — accepted to have a paid product and cover costs (ADR-0027). Guard against scope creep at v1.1/1.2; the dogfood loop (v1.0) stays the foundation.
