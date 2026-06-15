---
adr: 0008
title: Search & aggregation — lexical/FTS + faceted views + the agent; edge-semantic deferred
status: Accepted (rev 20)
slug: search
tags: [retrieval, aggregation]
---

# ADR-0008. Search & aggregation: lexical/FTS + faceted views + the agent; edge-semantic deferred

## Context

Search/aggregation must serve three readers (Obsidian, the app, the agent) without inventing a graph DB or shipping vectors prematurely.

## Decision

**Lexical/tag/FTS, model-free**, and **the agent does the smart part**. **Edge-semantic deferred.** The app runs lexical FTS on-device over its mirror, and Claude does agent-augmented search over coarse, bounded, GitHub-backed read tools — so the edge needs no index at v1.0/1.1. The **edge index lands at v1.2** (ADR-0009), giving the agent/edge rich whole-corpus FTS + aggregation; semantic/vectors stay deferred.

### Faceted aggregation (a sibling read mode)

Distinct from FTS (which queries *content*), aggregation queries **frontmatter facets** — `created`/`updated` (time buckets), `tags` (topic), `type` (kind, e.g. `type: todo`). Files are the truth; the grouping is a derived, disposable view. The on-device index carries **facet columns** beside the FTS5 content table, so grouping is a plain SQL `GROUP BY` (ADR-0009/0022). **Reuse Dataview/Datacore on desktop** (build nothing); a faceted `list(group_by, filter)` read tool serves the app/agent (ADR-0021). Light grouping (recent by day/week/tag/type) is v1; rich/saved/custom aggregations are post-MVP.

### FTS schema + driver injection

Two-table model per workspace: a contentless **`notes_fts`** (FTS5; columns `title, tags_text, body`; tokenizer **`unicode61 remove_diacritics 2`** — no stemming in v1) plus a **`notes_meta`** facet table (`id, path, type, thread, workspace, created, updated, created_ymd, created_ym, v, source_id`) joined to FTS via `rowid`. A junction **`notes_tags(note_id, tag)`** makes `GROUP BY tag` cheap; **`notes_aliases`** powers wikilink/alt-name resolution (ADR-0005); **`sources_meta`** mirrors note metadata for the `sources/` tree (default browse excludes `type: context`). Indices: `(type, created)`, `(thread, created)`, `(workspace, created)`, `(created_ym)`, `(tags.tag)`. Driver injected via a **`SqliteAdapter`** seam — `bun:sqlite` (CLI), `op-sqlite` (app), Cloudflare DO SQLite (edge, v1.2). The query layer exposes a single **`SearchEngine`** interface (`search`, `list` (faceted `group_by`), `listTags`, `listRecent`); full DDL + TS shapes in **[`docs/specs/core-spec.md`](../specs/core-spec.md)**. Rebuild-from-files is always the recovery path; on-device schema version sits in `zonot_meta(k, v)`.

## Consequences

v1.0/1.1 retrieval: app FTS + faceted grouping + coarse edge read tools + Obsidian/grep. Server-side (edge) indexing lands at v1.2 (ADR-0009); semantic stays deferred.
