---
adr: 0029
title: Ingestion, backfill & corroboration
status: Proposed (post-MVP; minimal importer in v1)
slug: ingestion-and-corroboration
tags: [ingestion, provenance, enrichment, scope]
---

# ADR-0029. Ingestion, backfill & corroboration

## Context

Ownership is bidirectional: a corpus must move *in* as cleanly as it moves out (the mirror of graceful obsolescence, ADR-0027). And search/aggregation can't be tuned without corpus volume.

**The primitive already exists.** A backfill is capture-at-scale with a different origin: raw lands as a `type: context` source node (verbatim, observability intact, ADR-0005); the provenance trailer records the origin (`Imported-From`/`Import-Of`, ADR-0007); enrichment into a `note` is optional and Tier-1. "Enrich or at least include with provenance" maps directly — provenance mandatory, enrichment opt-in. Bulk writes reuse ADR-0019's Git Trees API + tarball path.

## Decision

- **v1 — a minimal bulk importer** (the maker's own notes → convention envelope + import provenance). Loads a real corpus to exercise FTS + faceted aggregation under load (ADR-0008/0013); importing through the real write path *is* the volume test.
- **Post-MVP — format importers** as adapters: GBrain repos, vendor-memory exports (Claude/ChatGPT — the ADR-0025 complement made literal), loose Markdown / logbooks / daily dumps. Each is convention→convention into the versioned envelope (ADR-0012).
- **Post-MVP — corroboration, two axes.** **Artifact axis ("what was done"):** GitHub history (primary; reuses the existing GitHub auth — zero new dependency) → tickets (secondary). **Temporal axis ("when a decision was made"):** calendar (Google/Outlook). Corroborating artifacts are themselves source nodes; the agent (Tier 1) fetches and correlates, the operator only commits — trust budget preserved (ADR-0002/0019).

**Guardrail.** Zonot provides the convention + ingestion interface + provenance discipline; importers and corroboration connectors are agent-side, optional adapters. The operator stays a thin processor — **Zonot is not an integration platform.**

## Consequences

Graceful *onboarding* to match graceful obsolescence. Connector dependency growth tracked in ADR-0028; GitHub adds none.
