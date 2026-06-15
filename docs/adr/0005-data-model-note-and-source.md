---
adr: 0005
title: Data model — note (record) + conditional source (provenance); both editable
status: Accepted (rev 16)
slug: data-model-note-and-source
tags: [data-model]
---

# ADR-0005. Data model: note (record) + conditional source (provenance); both editable

## Context

The data model serves three audiences: the convention envelope, Obsidian/Dataview readers, and a fresh maintainer. Field discipline and body shape are load-bearing.

## Decision

**Note + conditional source; both editable.**

- **Note** (`notes/...`): system of record; body may be model-phrased.
- **Source** (`sources/...`): the raw as captured (verbatim original in git); excluded from browse. Frontmatter: `id, type: context, of, created, source, model, updated`.
- Verbatim raw lives only in the source node; the source node is **conditional**.

### Frontmatter discipline

Minimal-core / open-extension: a small **conformance-guarded required set** (ADR-0011) plus **tolerant pass-through** of unknown keys (forward- and community-compatible — Dataview/Datacore can use them; never validate-strip), Obsidian-property-shaped for free native rendering.

| Tier | Fields (note) | Notes |
|------|---------------|-------|
| **MUST** | `id` (ULID; stable identity decoupled from filename/title; time-ordered, so it doubles as a sort key), `v` (convention version, ADR-0012), `created` (ISO-8601 UTC `Z`), `tags` (a **list** — Obsidian-reserved, DC:subject) | v1 tag normalization: **lowercase · trim · spaces→hyphens · dedupe**, no gating vocab yet — full policy ADR-0018 #1 |
| **SHOULD** | `updated` (earns its place now that correct/edit is in v1), `type` | `type` is an **open note-kind vocabulary** — default `note`; free kinds like `todo`/`meeting`/`daily` drive aggregation; **`context` reserved** for source nodes / browse-exclusion; not an Obsidian-reserved key. *Naming note: `source` would align better with the canonical vocab (ADR-0014); `context` kept per the maker's read, cheap to swap.* |
| **COULD** | `aliases` (Obsidian-native; alt-name resolution for the connected/wikilink model), `thread` (the one authored edge, ADR-0006; **a single string slug in v1**, array is post-v1), `title` (optional; H1/filename often suffices), `workspace`, `source` (an in-file *pointer* = **the source node's ULID `id`**, single in v1; the source's reciprocal `of` = the note's id) | |
| **SHOULD NOT** | in-file provenance arrays or history (git owns this, ADR-0007); derived/computed data (backlinks, `related`, edge types, ranking — computed, ADR-0006); operator/device/sync state (the Obsidian `workspace.json` lesson); secrets/encryption; redefinitions of reserved keys | |

### Body convention

Adopted rev 13. The **compiled-truth-above / append-only-timeline-below** page shape (the Karpathy "LLM wiki" / GBrain pattern): current best understanding above a `---` rule; an append-only dated evidence log below (`- **YYYY-MM-DD** | source — what happened`). The **timeline is the append target** (ADR-0026) — on-ethos because it is additive, not a rewrite.

Divergence from GBrain: GBrain *rewrites* compiled truth in place against a Postgres truth; Zonot's truth is the file + git history, and rewriting compiled truth is the gated edit path, not a v1 default.

**Provenance on edit:** origin fields immutable; current-enrichment fields replaced (`model, updated`); the append-only history is git (ADR-0007). No in-file provenance array.

### Precedents & alignment

- **Obsidian Properties** for the frontmatter container — `tags` is its reserved key (always a YAML **list**, never a comma-string), ISO-8601 for `created`/`updated`, avoid reserved-key clashes (`aliases`, `cssclasses`), so it renders natively. **Datetime caveat:** Obsidian's native Date & time type is local ISO-8601 *without* a timezone; UTC `…Z`/offset strings store fine but render as plain Text (no native date-sorting / Bases comparison).
- **Dublin Core** for field semantics — `id`→identifier, `created`→date, `type`→type, `tags`→subject. Two mappings need care: DC `source` means *the resource from which a resource is derived* — only map `source`→`dc:source` if our `source` is a derivation; a capture channel/origin belongs in `dcterms:provenance` / the commit trailer. For `context`/`of`, prefer `dcterms:isPartOf` (thread containment, `of`) and `dcterms:references` (loose context) over generic `relation`.
- **W3C PROV** for the provenance graph — note `wasDerivedFrom` source; both `wasAttributedTo` a model/agent; the capture `wasGeneratedBy` an activity (the thread). Echo the relation names; no need to emit full PROV-O. Keep `thread` consistently an Activity. Conceptual kin: C2PA/Content Credentials; Denote for the id/filename.

## Consequences

Browse/read excludes `type: context` by default. The required set is the only thing the conformance test (ADR-0011) guards; everything else passes through.

## Open

Deferred to Phase 0 (conformance-locked, not prose — ADR-0011): exact Zod types/constraints, canonical frontmatter key order, YAML serialization style, and the slug-derivation algorithm.

## Evolution

- rev 16: kept `workspace`; split `source` into a commit trailer (event) and a frontmatter pointer (ULID, ADR-0007); `created` = ISO-8601 UTC `Z`, sort by ULID; `type` open note-kind vocab (reserved `context`); `thread` single slug; `source` single ULID; tag-norm lowercase/trim/hyphenate/dedupe.
