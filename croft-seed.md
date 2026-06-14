# Croft — Seed Decision Record

> Single-document handoff. Name **Croft** — a small plot you own and tend (here, your repo). See
> ADR-0014 for naming status: npm `croft` is free; the GitHub org and domain take a qualifier
> (e.g. `croft-dev`, `croft.app`), and the Lara Croft echo is an accepted brand shadow.
> A capture -> enrichment -> ingestion -> light-read layer over a plain-Markdown corpus the
> user owns; the wedge is a **connected mobile read/write bridge** (ADR-0025). Surfaces: a
> local-first mobile app (in the MVP), Obsidian, GitHub web, grep, the CLI. Ethos: **power,
> convenience, trust** – trust via observability and ownership.

> **Revision 19 (2026-06-14).** **Edge search moved into v1 at v1.2** (with hosted inference) — the
managed **rich tier** (ADR-0020): the per-tenant materialized **lexical** FTS + aggregation index
(ADR-0009) gives the agent/edge rich whole-corpus search; semantic/vectors stay deferred. v1.0/1.1
search stays device-FTS + Obsidian + agent-over-coarse-edge-tools (ADR-0008/0021). Honest consequence:
the per-tenant **Durable Object** enters v1.2, so the one real **Cloudflare lock-in deepens** (ADR-0028)
— accepted for the rich tier; the index is derivable/disposable and the MCP transport stays DO-free.

> **Revision 18 (2026-06-14).** Openness, providers, surfaces, edge-portability. **Added ADR-0032
(licensing & openness):** **open-core** (product open + self-hostable; managed layer closed) under a
**source-available, self-host-permitted, non-compete** license (recommended **FSL/BSL**, converts to
Apache-2.0 over ~2 years) — *run it freely, don't copy-and-sell it*; revises ADR-0027's "open-source"
wording. **Provider (shippable MVP):** v1.2 ships one hosted adapter (Workers AI); BYO = the agent
harness; no provider-picker / per-activity tiers / own-hardware (ADR-0027/0031 #7). **Novel surfaces**
named as extension examples — browser extension, email-in, VS Code (ADR-0031). **Cloudflare** is
convenient, not load-bearing; two soft gravity wells noted (Workers AI, Durable Objects; ADR-0028).

> **Revision 17 (2026-06-14).** Pulled the **managed-convenience model into v1** and added the
**extension architecture**. Revenue (ADR-0027) revised: managed **C1 enters v1** (no longer Phase 2)
and **hosted inference (Tier 2) is an opt-in C1 convenience** with cost + privacy guardrails (opt-in,
no-retention, no-train, output-observable; small-model + capped) — reversing rev-15's "no paid tier /
never charge for inference." **v1 is sequenced: v1.0 dogfood → v1.1 managed C1 (paid, ~$2–5 CAD) →
v1.2 hosted inference** (ADR-0020); a consciously larger MVP. Un-deferred **Tier 2** (ADR-0002), moved
**ADR-0017 custody/auth into v1**, resolved **ADR-0018 #5** (Workers AI / no-retention API), added
Tier-2 COGS guardrails (ADR-0019) and a trust-rule bullet (ADR-0001). **Added ADR-0031: extension
architecture** (closed kernel + typed extension points). ROADMAP + CLAUDE.md synced.

> **Revision 16 (2026-06-14).** Confirmed the core frontmatter field set (ADR-0005): `type` is an
open note-kind vocabulary (reserved `context` for source nodes), `thread` a single slug in v1,
`source` a single ULID pointer in v1, and a minimal v1 tag-normalization
(lowercase/trim/hyphenate/dedupe). Serialization, key order, and slug-derivation are deferred to
Phase 0 under the conformance test. **Revenue (rev 15) reopened for refinement** — hosted inference
vs pay-your-own-model, and whether the target MVP includes the managed-convenience tier (pricing
~$2–5 CAD or less) — pending.

> **Revision 15 (2026-06-14).** Landed the **revenue decision** (ADR-0027): the *posture* is Accepted
— free C0 self-host forever; paid C1 = convenience; never charge for data or inference; client-side
inference keeps operator COGS ≈ the Workers floor — while the **C1 mechanism rides ADR-0017 (Phase
2)** and **v1 ships no paid tier** (Phase 1 = single-user self-host, ADR-0013), so revenue is off the
v1 critical path. (Frontmatter-schema precision is being calibrated separately — ADR-0005.)

> **Revision 14 (2026-06-14).** Captured two growth vectors and a read mode after the wedge review.
**Added** ADR-0029 (ingestion, backfill & corroboration – the mirror of graceful obsolescence; a
**minimal bulk importer enters v1** as the search/aggregation test-data enabler, ADR-0020/0013;
format importers + the two-axis corroboration model – GitHub-primary artifact axis reusing existing
auth, calendar temporal axis, tickets secondary – stay post-MVP) and ADR-0030 (context-collection
patterns – active/scheduled/prompted capture as a trigger layer over the same handlers). **Extended**
ADR-0008 with **faceted aggregation** (a sibling read mode over frontmatter facets; light grouping in
v1, rich post-MVP). **Updated** ADR-0022 (handlers are origin/trigger-agnostic) and ADR-0028
(corroboration connectors as optional, client-side dependencies).

> **Revision 13 (2026-06-14).** Scope-reconciliation pass after the prior-art + wedge review.
**Wedge locked:** Croft is the *connected mobile read/write notes client* that bridges on-the-go
capture/reading with a desktop-centric, git-native, agent-enriched workflow; **files are the truth**
(the inverse of GBrain's DB-as-truth projection). **Scope amended** (ADR-0004/0010/0015/0020): v1 is
creates **+ append + a bounded correction surface** (edit-recent / undo / delete); mobile is
**read/write** (v1 writes ride the edge; device git-sync is the C0 / post-MVP ownership upgrade).
**Build order reordered** (ADR-0024) so the app is no longer strictly last. **Added** ADR-0025 (wedge
& positioning), 0026 (operation vocabulary & bounded mutation), 0027 (graceful obsolescence,
longevity & revenue), 0028 (dependency & risk register). **Resolved** ADR-0018 #8 (edge-first sync)
and #10 (edge SHA-conditional edit policy); **settled** the ADR-0005 field set (minimal-core /
open-extension) and adopted the compiled-truth + append-only-timeline body shape; **folded** concrete
port choices into ADR-0022; **added** a Glossary; **dropped** the undefined `register` from the
canonical set. Three frontmatter tensions are resolved with
leanings and flagged for review (ADR-0005 Open).

> **Revision 12 (2026-06-14).** Prior-art / standards review pass (no strategy change). Corrected
standards citations in **ADR-0021/0022** (Idempotency-Key is an expired IETF *draft*, not a ratified
standard; pinned the MCP spec revision `2025-11-25`) and refined the **ADR-0005** precedents (Dublin
Core `source`/`relation` semantics; Obsidian datetime typing). Added a **sync-divergence guard** –
non-fast-forward = hard stop, fetch -> merge -> re-push, conflict-copy-as-create, secure on-device
credential – to **ADR-0010/0015**, and expanded the **ADR-0018 #3** benchmark spec. Open follow-ups
left for the maker: resolve the ADR-0005 field set; a competitive-positioning ADR (GBrain / Basic
Memory / nanobrain now occupy adjacent ground); a glossary defining `register`. *(All addressed in
rev 13/14.)*

> **Revision 11 (2026-06-07).** Added **ADR-0024: project scaffold** – Bun runtime (core/CLI/Worker
> dev + single-binary build), one pnpm monorepo with the app in-tree, Biome, and build order
> core -> Worker -> CLI -> app. Hand-authored `CLAUDE.md` produced alongside (the one non-generated
> seed file). Prior: rev 10 rename to Croft + seeding model; rev 9 CLI distribution (0023); rev 8
> isomorphic-git verdict; rev 7 reuse pass + precedents; rev 6 app-in-MVP; rev 5 prune.

-----

## How to use this document (seeding model)

This doc is the **single source of truth** for Croft’s decisions and the **input to repo seeding**.
The seeding philosophy: keep one source of truth and **generate** the rest rather than hand-ship a
static file tree that drifts. Concretely:

1. **`CLAUDE.md` is hand-authored and reviewed** (not generated). It is the operating contract
   Claude Code reads every session, so its quality compounds – it states the non-negotiables, the
   reuse idioms, tier discipline, and what is out of scope, and it points to this doc. Author it
   deliberately; do not auto-draft it.
1. **Claude Code generates the rest at `croft init` / first run**, from this doc:
- **Explode each `ADR-NNNN` section into `docs/adr/NNNN-<slug>.md`** (`# NNNN. <Title>` /
  `- Status` / `- Tags` / `## Context ## Decision ## Consequences`/`## Open`) – a deterministic
  transform, not worth pre-generating.
- **Generate `docs/adr/README.md`** as the index.
- **Draft `docs/philosophy.md` and `docs/architecture.md`** from this doc for human review.
1. **Honor statuses:** Accepted -> locked; Proposed -> resolve before first implementation; Open
   -> tracked in 0018; Withdrawn -> placeholder.
1. **One canonical name per concept:** `capture - source - note - thread - tier - reader - agent - workspace` (see **Glossary**). No theming.

Rationale: the mechanical and derivable artifacts (ADR tree, index, orientation prose) are exactly
what Claude Code does reliably from a clear spec, and generating them in-repo keeps them downstream
of one source instead of a second hand-maintained copy. Only `CLAUDE.md` – small, load-bearing,
and read by the agent itself – earns a deliberate human pass up front.

-----

## Glossary

One canonical name per concept (ADR-0014); no theming. Definitions are derived from the ADRs.

- **capture** – the act/event of submitting input that becomes a note; pushed to the lowest tier (ADR-0002).
- **source** – the raw-as-captured node (verbatim original, `type: context`); conditional, excluded from browse (ADR-0005).
- **note** – the system-of-record record in `notes/`; body may be model-phrased (ADR-0005).
- **thread** – the one authored lineage edge grouping related captures/notes; a PROV Activity (ADR-0006).
- **tier** – the capture tier (0 CLI-direct · 1 client-enriched · 2 edge-auto-classify) = the privacy/trust gradient (ADR-0002).
- **reader** – a read surface over the corpus: the mobile app, Obsidian, GitHub web, grep, the CLI (ADR-0010).
- **agent** – the AI (e.g. Claude) that enriches captures over the MCP tool surface (ADR-0002/0021).
- **workspace** – one notes repo = one workspace; one repo per workspace (ADR-0003).

-----

## Decisions

### ADR-0001. Observable plain files are the trust mechanism

**Status:** Accepted (rev 5) - **Slug:** `trust-model-observability` - **Tags:** north-star, custody

- **Decision.** Trust comes from **observability, not encryption**. Every byte the agent writes
  lands as plain Markdown in a repo the user owns; raw input is preserved (verbatim at capture, in
  git history thereafter). The operator is a **processor, not a store**.
- **Custody is a disclosed, bounded, opt-in tier** (C0/C1, ADR-0017).
- **Hosted inference is bounded by the same rule (ADR-0027).** Tier-2 enrichment (C1) is **opt-in,
  no-retention, no-train, and output-observable** — the `Model` trailer + the plain-Markdown result
  let you inspect exactly what it produced. **C0 / BYO-model is the zero-operator-read floor.**
- **Consequences.** A derived index is a durable copy – needs to be ephemeral (ADR-0009). The audit
  guarantee lives in git history; force-push protection is a sensible default (ADR-0007), not a hard
  gate. Irreducible floor (managed): the GitHub App private key (ADR-0017); self-host (C0) is the
  only zero-custody option.

### ADR-0002. Three-tier capture; push every interaction to the lowest tier

**Status:** Accepted (rev 3) - **Slug:** `three-tier-capture` - **Tags:** architecture, custody

- **Decision.** **Tier 0** – CLI -> GitHub directly. **Tier 1** – enriched API: client (Claude)
  enriched; edge validates + commits. **Tier 2** – auto-classify: edge runs a model. **In v1 (C1,
  at v1.2) as guardrailed hosted inference** – opt-in, no-retention, output-observable, small-model +
  capped (ADR-0027); ADR-0018 #5 picks the model.
- **Consequences.** The ladder is the privacy gradient / trust budget: in-transit operator reads
  only at Tier 2 (ADR-0019). The reader’s on-device LLM (post-MVP) decouples enrichment locus from
  custody locus. Reused on read (ADR-0008).

### ADR-0003. Substrate: Markdown in the user’s GitHub repo, one repo per workspace

**Status:** Accepted - **Slug:** `substrate-and-layout` - **Tags:** storage, layout

- **Decision.** Plain Markdown, **one repo per workspace**. Layout: `notes/YYYY/MM/<id>-<slug>.md`;
  `sources/YYYY/MM/<id>.md`. git over new-file-per-note already *is* the append-only log.
- **Consequences.** Date-partitioning bounds directory size. Provenance defaults to same-repo
  `sources/`; separate-repo is the privacy/bulk option (ADR-0018).

### ADR-0004. One file per note; editable in place via a version-aware path

**Status:** Accepted (rev 4) - **Slug:** `file-per-note` - **Tags:** storage, concurrency

- **Decision.** **New file per note.** **Captures are creates** (conflict-free). v1 also exposes a
  **bounded mutation surface** (ADR-0026): **append** (a dated block to a note's timeline –
  near-conflict-free) and a **correction surface** – **edit-recent / undo / delete** – for cleaning
  up erroneously submitted content. Mutations are **SHA-conditional updates** (ADR-0015);
  arbitrary/historical editing stays gated.
- **Consequences.** Conflict-freedom absolute for captures and near-absolute for appends; the
  correction surface is recency-scoped and edge-mediated, so single-writer conflict risk is ~zero
  (ADR-0026). Undo/delete are **new commits** – history preserves everything, so they tidy `HEAD`
  without rewriting the record (ADR-0007). **Rejected – daily-file consolidation.** Narrative docs
  stay single-file.

### ADR-0005. Data model: note (record) + conditional source (provenance); both editable

**Status:** Accepted (rev 16) - **Slug:** `data-model-note-and-source` - **Tags:** data-model

- **Decision.**
  - **Note** (`notes/...`): system of record; body may be model-phrased.
  - **Source** (`sources/...`): the raw as captured (verbatim original in git); excluded from
    browse. Frontmatter: `id, type: context, of, created, source, model, updated`.
  - Verbatim raw lives only in the source node; the source node is **conditional**.
- **Frontmatter discipline (minimal-core / open-extension).** A small **conformance-guarded
  required set** (ADR-0011) plus **tolerant pass-through** of unknown keys (forward- and
  community-compatible – Dataview/Datacore can use them; never validate-strip), Obsidian-property-
  shaped for free native rendering. For the **note**:
  - **MUST:** `id` (ULID; stable identity decoupled from filename/title; time-ordered, so it doubles
    as a sort key), `v` (convention version, ADR-0012), `created` (ISO-8601 UTC `Z`), `tags` (a
    **list** – Obsidian-reserved, DC:subject; **v1 normalization: lowercase · trim · spaces→hyphens ·
    dedupe**, no gating vocab yet — full policy ADR-0018 #1).
  - **SHOULD:** `updated` (earns its place now that correct/edit is in v1), `type` (**open note-kind
    vocabulary** – default `note`; free kinds like `todo`/`meeting`/`daily` drive aggregation;
    **`context` reserved** for source nodes / browse-exclusion; not an Obsidian-reserved key. *Naming
    note: `source` would align better with the canonical vocab (ADR-0014); `context` kept per the
    maker's read, cheap to swap.*).
  - **COULD:** `aliases` (Obsidian-native; alt-name resolution for the connected/wikilink model),
    `thread` (the one authored edge, ADR-0006; **a single string slug in v1**, array is post-v1),
    `title` (optional; H1/filename often suffices), `workspace`, `source` (an in-file *pointer* =
    **the source node's ULID `id`**, single in v1; the source's reciprocal `of` = the note's id).
  - **SHOULD NOT:** in-file provenance arrays or history (git owns this, ADR-0007); derived/computed
    data (backlinks, `related`, edge types, ranking – computed, ADR-0006); operator/device/sync
    state (the Obsidian `workspace.json` lesson); secrets/encryption; redefinitions of reserved keys.
- **Body convention (adopted rev 13).** The **compiled-truth-above / append-only-timeline-below**
  page shape (the Karpathy "LLM wiki" / GBrain pattern): current best understanding above a `---`
  rule; an append-only dated evidence log below (`- **YYYY-MM-DD** | source — what happened`). The
  **timeline is the append target** (ADR-0026) – on-ethos because it is additive, not a rewrite.
  Divergence from GBrain: GBrain *rewrites* compiled truth in place against a Postgres truth; Croft's
  truth is the file + git history, and rewriting compiled truth is the gated edit path, not a v1
  default.
- **Provenance on edit:** origin fields immutable; current-enrichment fields replaced
  (`model, updated`); the append-only history is git (ADR-0007). No in-file provenance array.
- **Precedents & alignment.**
  - **Obsidian Properties** for the frontmatter container – use `tags` (its reserved key, always a
    YAML **list**, never a comma-string), ISO-8601 for `created`/`updated`, avoid reserved-key
    clashes (`aliases`, `cssclasses`), so it renders natively in the reader. **Datetime caveat:**
    Obsidian's native Date & time type is local ISO-8601 *without* a timezone; our UTC `…Z`/offset
    strings store fine but render as plain Text (no native date-sorting / Bases comparison). Accept
    that, or store offset-free – decide before the schema calcifies.
  - **Dublin Core** for field semantics – `id`->identifier, `created`->date, `type`->type,
    `tags`->subject. **Two mappings need care:** DC `source` means specifically *the resource from
    which a resource is derived* – only map `source`->`dc:source` if our `source` is a derivation; a
    capture *channel/origin* belongs in `dcterms:provenance` / the commit trailer, not `dc:source`.
    For `context`/`of`, prefer the refinements `dcterms:isPartOf` (thread containment, `of`) and
    `dcterms:references` (loose context) over the generic `relation`.
  - **W3C PROV** for the provenance graph – note `wasDerivedFrom` source; both `wasAttributedTo`
    a model/agent; the capture `wasGeneratedBy` an activity (the thread). Echo the relation names;
    no need to emit full PROV-O. Keep `thread` consistently an Activity (never also an Entity).
    Conceptual kin: C2PA/Content Credentials; Denote for the id/filename.
- **Consequences.** Browse/read excludes `type: context` by default. The required set is the only
  thing the conformance test (ADR-0011) guards; everything else passes through.
- **Resolved (rev 16 – maker-confirmed).** Three tensions: (1) **keep `workspace`** (cheap;
  self-describing across repos); (2) **split `source`** – provenance *event* in the commit trailer
  (ADR-0007), in-file *pointer* (= source node's ULID) in frontmatter; (3) **`created` = ISO-8601 UTC
  `Z`**, sort by ULID (Obsidian renders the string as Text — accepted). Four design calls: **`type`**
  open note-kind vocab (reserved `context`); **`thread`** single slug in v1; **`source`** single ULID
  pointer in v1; **tag-norm** lowercase/trim/hyphenate/dedupe, no gating vocab.
- **Deferred to Phase 0 (conformance-locked, not prose — ADR-0011):** exact Zod types/constraints,
  canonical frontmatter key order, YAML serialization style, and the slug-derivation algorithm.
  Pinning these in the seed doc is false precision; the conformance test is their home.

### ADR-0006. Lineage: authored note<->source and thread; related is computed; history in git

**Status:** Accepted (rev 4) - **Slug:** `lineage` - **Tags:** data-model, lineage

- **Decision.** Two authored edges: **note<->source** and **`thread`**. **Related is computed**
  (`search(seed=note)`). **No supersession field** – evolution is an edit; git is the append-only
  record.
- **Consequences.** Append-only lives at the git layer. Tag-cohort/time-window are ranking inputs
  only.

### ADR-0007. Git history is the immutability guarantee; provenance in commit trailers

**Status:** Accepted (rev 5) - **Slug:** `git-as-ledger` - **Tags:** git, provenance

- **Decision.** The **git commit history is the append-only, immutable record**. **Force-push
  protection is a sensible default, not a hard gate.** **Provenance in a commit trailer on every
  write** (`Source`, `Capture-Id`/`Edit-Of`, `Model`, plus `Undo-Of`/`Delete-Of` for the correction
  surface, ADR-0026) – so even deletions are first-class, attributable events.
- **Consequences.** Per-note history meaningful. Read the file for current state, git for history.
  **Editing `HEAD` is expected; rewriting *history* (force-push) stays protected** – the bright line
  that makes undo/delete safe (you tidy the present, never erase the record).

### ADR-0008. Search & aggregation: lexical/FTS + faceted views + the agent; edge-semantic deferred

**Status:** Accepted (rev 19) - **Slug:** `search` - **Tags:** retrieval, aggregation

- **Decision.** **Lexical/tag/FTS, model-free**, and **the agent does the smart part**.
  **Edge-semantic deferred.** The app runs lexical FTS on-device over its mirror, and Claude does
  agent-augmented search over **coarse, bounded, GitHub-backed read tools** – so the edge needs no
  index **at v1.0/1.1**. The **edge index lands at v1.2** (ADR-0009), giving the agent/edge rich
  whole-corpus FTS + aggregation; **semantic/vectors stay deferred**.
- **Faceted aggregation (a sibling read mode, rev 14).** Distinct from FTS (which queries *content*),
  aggregation queries **frontmatter facets** – `created`/`updated` (time buckets), `tags` (topic),
  `type` (kind, e.g. `type: todo`). Files are the truth; the grouping is a derived, disposable view.
  The on-device index carries **facet columns** beside the FTS5 content table, so grouping is a plain
  SQL `GROUP BY` (ADR-0009/0022). **Reuse Dataview/Datacore on desktop** (build nothing); a faceted
  `list(group_by, filter)` read tool serves the app/agent (ADR-0021). Light grouping (recent by
  day/week/tag/type) is v1; rich/saved/custom aggregations are post-MVP.
- **Consequences.** v1.0/1.1 retrieval: app FTS + faceted grouping + coarse edge read tools +
  Obsidian/grep. Server-side (edge) indexing lands at **v1.2** (ADR-0009); semantic stays deferred.

### ADR-0009. Content index: ephemeral per-tenant materialization (edge search, v1.2)

**Status:** Accepted (rev 19) - **Slug:** `ephemeral-materialization` - **Tags:** retrieval, indexing, custody

- **Decision.** **No persistent fleet-wide content index.** When edge search is needed, materialize
  per-tenant on demand: a **per-tenant Durable Object (SQLite), scale-to-zero, rebuild-on-wake**.
  SQLite-everywhere via the shared core (ADR-0011/0022). Tag vocabulary in KV. All
  derived/rebuildable.
- **Scope (rev 19).** **Edge search enters v1 at v1.2** (with hosted inference, ADR-0020) — the
  agent/edge get rich whole-corpus **lexical** FTS + aggregation; **semantic/vectors stay deferred**.
- **Consequences.** Partitioning friction dissolves; cold tenants expose nothing; rebuild-on-wake
  means no freshness problem. The per-tenant DO is **Cloudflare-specific** — pulling it into v1.2
  **deepens the one real Cloudflare lock-in** (ADR-0028); it stays a derivable/disposable adapter
  (rebuild-on-wake), distinct from the MCP transport (which stays DO-free via `createMcpHandler`).
  Persisted/vector stores are deferred – vectors + ids only, never raw bodies.

### ADR-0010. The mobile app: a connected local-first read/write bridge (MVP wedge)

**Status:** Accepted (rev 13) - **Slug:** `reader-app` - **Tags:** app, offline, retrieval

- **The wedge (rev 13).** The mobile app is the **differentiated surface**: a connected, local-first
  **read/write** client that bridges on-the-go capture/reading with the desktop-centric, git-native,
  agent-enriched workflow (Obsidian / Claude / CLI / grep). The desktop is the workshop (reused), the
  phone is the front door. It is still *not* a full editor or knowledge graph.
- **MVP surface (mindful).**
  - **Core screens:** capture, browse/search, read, **and a bounded correction surface**
    (edit-recent / undo / delete, ADR-0026). Feature-minimal – still never a full editor or graph.
  - **Offline-first:** a **local mirror (clone)** + a **local capture queue**.
  - **Lexical/FTS search on-device** (op-sqlite, model-free) over the mirror (ADR-0008/0009).
  - **Writes ride the edge in v1.** App writes (capture/append/correct/undo/delete) go through the
    Worker over HTTP, so edits are **edge-mediated SHA-conditional** (a tractable 412 → refetch →
    reapply, not a device git merge); enriched capture comes from Claude/MCP, quick-capture is
    Tier-0-style.
  - **Stack:** native Expo React Native, reusing Fathom’s local-first (op-sqlite) patterns.
- **Sync (post-MVP git path; v1 rides the edge — ADR-0022).** The app holds a clone and uses **isomorphic-git**
  (pure-JS, no native deps) to fetch/pull/push – reusing git’s delta protocol and gaining local
  history, which **removes any bespoke changes-feed/cursor** (git fetch *is* the delta).
  - **Viable in pure-JS at our scale; no native eject for the MVP.** The repo is tens of thousands
    of *tiny*, mostly-additive Markdown files and the device needs no history, so the cost structure
    is benign: **shallow clone (`depth: 1`)** is the only heavy op (seed from an edge-served tarball
    if even that drags on a low-end device); pulls/pushes move small deltas. The documented
    packfile-reparse perf trap is avoided by the app’s narrow git surface (clone once, then
    add/commit/push) and by using `statusMatrix` + the `cache` object if status is ever needed.
  - **RN is not browser-CORS-bound**, so the app talks to GitHub directly (use the `http/web`
    client); the edge Worker is only a fallback proxy. The LightningFS “flush or corrupt” warning is
    browser-only – RN uses a real-fs adapter (expo-file-system / react-native-fs) – but still
    ensure durable write ordering and treat the capture queue as source of truth until push confirms.
  - **Native fallback:** libgit2 via a Nitro/Turbo module (native modules already ship under Expo
    CNG, e.g. op-sqlite) – **gated on a benchmark (ADR-0018 #3), not the default**; it would cost
    platform-specific builds and break the core’s pure-isomorphic-TS property.
  - **MVP (C1, app via edge):** may sync HTTP-over-edge to keep v1 simple; the **git path is the
    C0 / post-MVP sync** (app pushes directly with the user’s credential).
  - **Divergence policy (non-negotiable; the device git-sync path, post-MVP).** A non-fast-forward
    push is a **hard stop, never an overwrite** – `force` is forbidden on the write path (silent fast-forward overwrite is the
    trust-breaking bug every git-backed notes app hits – Obsidian-Git “plows forward”, GitJournal
    overwrites desktop edits). The write client runs a **fetch -> merge -> re-push loop** as a
    first-class operation; for two concurrent *creates* the merge is trivial (disjoint files). On
    the rare same-note edit collision, **write the loser as a new conflict-copy note** (itself a
    conflict-free create) rather than emitting `<<<<<<<` markers into a body or doing a silent
    last-write-wins. Keep device/app state **out** of the synced tree (track only `notes/`/`sources/`;
    Obsidian’s worst conflicts were `workspace.json` churn, not notes). **ULIDs – not wall-clock
    filenames/timestamps – are the identity/ordering key** (tolerate clock skew). Store the GitHub
    credential in the platform secure store (iOS Keychain / Android Keystore), scoped to the one
    workspace repo.
- **Deferred to post-MVP.** On-device embedding + enrichment models (the operator-free node);
  C0 direct git sync; (the delta/cursor protocol is moot under git – ADR-0022).
- **Consequences.** A connected mobile read/write bridge without bundling models – a small but
  *complete* surface for the dogfood loop. The model-powered, operator-free, git-syncing app is the
  post-MVP differentiator (the C0 ownership upgrade).

### ADR-0011. One isomorphic core enforces the convention and owns the engine

**Status:** Accepted (rev 7) - **Slug:** `components-and-core` - **Tags:** architecture, code

- **Decision.** All TypeScript, one codebase. **Shared core** (isomorphic, web-standard APIs only)
  runs in the Worker, the CLI, and the app. Owns convention/normalization, frontmatter, slug/id,
  the **write client** (one *interface*, two backends – ADR-0022), and the FTS search engine over a
  SQLite-driver interface. **CLI** – single binary, no model. **Edge** – Worker: the tool surface
  (ADR-0021) + (v1.2) the per-tenant DO for edge search (ADR-0009). **App** – core + op-sqlite, no models in v1.
  - **Conformance test scope:** byte-identical convention envelope (frontmatter, slug, id, file
    structure) across CLI and edge. Not enriched bodies; not cross-surface search results.
- **Consequences.** Watch Worker weight vs size limits; the core stays kilobytes.

### ADR-0012. Version the note convention from day one

**Status:** Accepted - **Slug:** `convention-versioning` - **Tags:** data-model, migration

- **Decision.** Every note carries `v: 1` from the first capture; convention changes ship with a
  forward migration (in the core); readers tolerate known prior versions.
- **Consequences.** Absorbs the live-dogfood churn risk; migrations are observable, reversible.

### ADR-0013. Phase 1: single-user, remote Worker as the live test harness

**Status:** Accepted - **Slug:** `phase-1-deployment` - **Tags:** phasing, auth, hosting, testing

- **Decision.** A **deployed remote Worker** over HTTPS (Streamable HTTP). Connector auth:
  **path-secret URL**. GitHub auth: one fine-grained PAT in a Worker secret. Static workspace map.
  **Testing = live dogfood.** The app talks to this same Worker.
- **Sequencing (rev 17).** This single-user harness is **v1.0** (the dogfood loop). **v1.1**
  introduces multi-tenant **managed custody (C1, ADR-0017)** — so architect multi-tenant and the
  Tier-2 enrichment seam from day one, even though v1.0 ships single-user.
- **Consequences.** The Worker is Phase 1. Keep the data model operator-agnostic to keep self-host
  open.

### ADR-0014. Documentation discipline and naming

**Status:** Accepted (rev 10) - **Slug:** `docs-discipline-and-naming` - **Tags:** docs, naming

- **Decision.** Small fixed doc set; ADRs one-idea-per-file, numbered, append-only once sealed.
  Repo-specific ADRs in-repo; general knowledge graduates to a skill (nuance parked). One canonical
  name per concept; no theming. **Name: Croft** – a small plot you own and tend (the metaphor for
  a repo you own and cultivate).
- **Name due diligence (rev 10).** Chosen after rejecting goat notes (taken in AI-notes; GoodNotes
  phonetic clash), Cairn (an adjacent agent-on-your-GitHub-repos project, try-cairn.com), and Trig
  (the W3C `.trig` RDF format, an in-domain clash). Croft: **npm `croft` is free**; the bare GitHub
  org and `croft.com` are taken, so use a **qualifier** (`croft-dev` / `croftlabs` org; `croft.app`
  or `getcroft.com`); main brand shadow is **Lara Croft**, accepted as out-of-class. The npm name
  is plumbing under the CLI (ADR-0023); the load-bearing surfaces are the GitHub org, domain,
  app-store name, and the `croft` CLI verb.
- **Open.** Confirm a free GitHub org qualifier; register a domain (ADR-0018 #7).

### ADR-0015. Write path: version-aware; atomicity and idempotency

**Status:** Accepted (rev 6) - **Slug:** `write-path-atomicity-idempotency` - **Tags:** write-path

- **Decision.** **Idempotency:** a generated **ULID** id (+ optional client idempotency key).
  **Mutations:** SHA-conditional updates; the write client is version-aware from day one; v1 exposes
  **creates + append + a bounded correction surface** (edit-recent / undo / delete, ADR-0026);
  arbitrary/historical editing stays gated. **Atomicity:** note + source in one commit (Git Data API
  tree, or two Contents calls for v1 simplicity); delete/undo remove note (+ its source) in one commit.
- **Divergence (clone-holder backend).** Non-fast-forward push is a **hard stop, never `force`**;
  the write client resolves via **fetch -> merge -> re-push** (ADR-0010). Treat the local commit and
  the remote push as separate, idempotent, **resumable** stages – on startup, reconcile any local
  commits ahead of the remote (re-attempt the push; never assume the last session finished). The
  HTTP Idempotency-Key discipline mirrors this on the device git path.
- **Open.** Tree vs two Contents calls; edit conflict-resolution policy (resolved ADR-0018 #10 –
  edge SHA-conditional, single-user-rare).

### ADR-0016. Index freshness and reader sync

**Status:** Withdrawn (rev 5) - **Slug:** `index-freshness-sync` - **Tags:** withdrawn

- Folded into ADR-0009 (rebuild-on-wake => no freshness problem) and ADR-0010/0022 (git-as-sync).
  Placeholder; do not seed as a concern.

### ADR-0017. Custody tiers, auth, and distribution

**Status:** Accepted (rev 17; C1 enters v1 at v1.1) - **Slug:** `custody-tiers-auth-distribution` - **Tags:** auth, custody, distribution, self-host

- **Decision (proposed) – two tiers; user picks; app-store default C1.**
  - **C0 – zero custody (self-host / BYO).** User supplies their own GitHub App / PAT; operator
    holds nothing. (The git-syncing app, ADR-0010, is the natural C0 client.)
  - **C1 – managed custody.** Repo in the user’s own GitHub account. GitHub App scoped to
    **Contents: read-write + Metadata: read only**, installed on **only the one notes repo**; holds
    durably **only the App private key**; mints short-lived tokens per request; persists none.
  - **MCP auth:** OAuth 2.1 + CIMD (DCR deprecated fallback); RFC 9728 PRM; RFC 8707; Streamable
    HTTP; no token passthrough.
  - **Onboarding wrapper (C1):** OAuth in + one App-install click on an auto-created repo; set
    sensible repo defaults (incl. force-push protection); write per-user config.
- **Sequencing (rev 17).** C1 managed custody **enters v1 at v1.1** (ADR-0020), no longer Phase 2 —
  the OAuth 2.1 + GitHub App + token-minting stack is now in v1 scope. v1.0 remains single-user
  (path-secret + PAT, ADR-0013); C1 hosted inference follows at v1.2 (ADR-0002/0027).
- **Consequences.** Per-token capability bounded to one repo for <=1h. Population breadth: the App
  key spans all C1 installs – the irreducible C1 floor; minimize, don’t pretend to erase. No-GitHub
  mass-consumer not served. App-store: fine fit.
- **Open.** App-sync default (lean C0); onboarding partial-failure recovery; directory submission.

### ADR-0018. Open questions register

**Status:** Open - **Slug:** `open-questions-register` - **Tags:** tracking

1. Tag normalization thresholds / policy.
1. Edge operational observability – logging/tracing, or is data-observability enough?
1. **RN isomorphic-git validation (go/no-go for pure-JS vs native).** Confirm the fs-adapter
   surface (expo-file-system / react-native-fs: `readFile/writeFile/readdir/stat/lstat/symlink`…)
   is complete – **verify `symlink`/`lstat` explicitly; they are the likeliest RN-fs gaps** – then
   benchmark a **`depth:1` clone + pull + push *and the fetch -> merge -> re-push loop on a
   divergent push*** (not just clone/pull/push in isolation) against a ~20-50k-file corpus on a
   **mid-range Android** device (not a simulator). Pure-JS is the default; native libgit2 only if
   the benchmark fails (ADR-0010/0022). Run this as an early spike – it is load-bearing. **Off the
   v1 critical path** (v1 writes ride the edge, ADR-0010); it gates the device git-sync upgrade.
1. Provenance placement – same-repo `sources/` vs separate repo.
1. **Auto-classify edge model (Tier 2) – resolved (rev 17):** Workers AI (on-edge, no third-party
   egress) or a no-retention API tier; **narrow (light enrichment) + capped** per the C1
   hosted-inference guardrails (ADR-0027/0019).
1. Skill vs in-repo split nuance (ADR-0014).
1. **Name follow-through (Croft chosen, ADR-0014).** Confirm a free GitHub org qualifier
   (`croft-dev` / `croftlabs` / `getcroft`) and register a domain (`croft.app` / `getcroft.com`);
   npm `croft` already free. Lara Croft is an accepted out-of-class shadow.
1. **App-sync default – resolved (rev 13):** v1 reads+writes ride the **edge HTTP** path; device
   **git-sync is the C0 / post-MVP** ownership upgrade (ADR-0010).
1. On-device enrichment model – which model/size/quantization (post-MVP).
1. **Edit conflict-resolution policy – resolved (rev 13):** edge-mediated **SHA-conditional**
   (412 → refetch → reapply), single-user-rare; the device-git divergence guard covers the post-MVP
   git path (ADR-0010/0026).

### ADR-0019. Cost and trust budget

**Status:** Accepted (rev 5) - **Slug:** `cost-and-compute-budget` - **Tags:** cost, performance, custody

- **It’s text; it’s cheap.** No egress charges; FTS avoids full scans; the real floor is the
  $5/mo Workers Paid base.
- **Two rules:** (1) never build/rebuild the index on the read path; (2) rebuild in bulk (Git Trees
  API + tarball) – the constraint is GitHub’s rate limit, not dollars.
- **Trust budget:** in-transit operator reads only at Tier 2; the operator-free C0 reader touches
  the operator at no point.
- **Revenue posture (ADR-0027).** Base inference is client-side (Tier 1) and storage is the user's
  repo, so base operator COGS ≈ the Workers floor; **C1 hosted inference (v1.2) adds *bounded* Tier-2
  COGS** (next). The paid tier sells *convenience* (managed custody + optional hosted inference),
  never access to your own data.
- **Tier-2 hosted-inference COGS (C1, rev 17).** Bounded by design: **light enrichment only**
  (tag/title/classify, small token counts), a **small/cheap model** (Workers AI or a no-retention
  API), and **per-user monthly caps** (degrade to BYO past the cap). ≈ cents/user/month; the C1 price
  covers it (ADR-0027).

### ADR-0020. MVP scope (Phase 1, v1)

**Status:** Accepted (rev 6) - **Slug:** `mvp-scope` - **Tags:** scope, phasing

- **In v1, sequenced (rev 17).**
  - **v1.0 — dogfood loop:** shared core (capture + append + bounded correction, ADR-0026); **CLI**
    (Tier 0); **Edge Worker** tool surface (ADR-0021); **mobile read/write bridge** (ADR-0010);
    GitHub writes via the edge; basic tag normalization; one-time repo init; read/search + **light
    faceted aggregation** (ADR-0008); a **minimal bulk importer** (ADR-0029). Single-user
    (path-secret + your PAT, ADR-0013).
  - **v1.1 — managed C1:** multi-tenant **managed custody** — OAuth 2.1 + GitHub App + billing
    (ADR-0017); the first **paid tier** (BYO-model), ~$2–5 CAD (ADR-0027).
  - **v1.2 — rich managed tier (C1):** **guardrailed Tier-2 hosted inference** (opt-in, no-retention,
    output-observable, small-model + capped; ADR-0002/0019/0027) **+ edge search** — the per-tenant
    materialized lexical FTS + aggregation index (ADR-0009), giving the agent/edge rich whole-corpus
    search.
- **Deferred (post-v1).** On-*device* enrichment models; **arbitrary/historical edit** (the *bounded*
  correction surface is in v1); **semantic / vector search** (lexical edge search is in at v1.2);
  **device git-sync (C0)**; **format importers + corroboration connectors** (ADR-0029); **rich/custom
  aggregations** (ADR-0008).
- **Consequences.** v1 now spans **dogfood → paid managed product → hosted-inference convenience**,
  sequenced so each step ships and validates. This is **consciously larger than a dogfood-only MVP** —
  accepted to have a paid product and cover costs (ADR-0027). Guard against scope creep at v1.1/1.2;
  the dogfood loop (v1.0) stays the foundation.

### ADR-0021. Tool & sync contract (MVP)

**Status:** Proposed (shapes ready to confirm) - **Slug:** `tool-and-sync-contract` - **Tags:** api, mcp, app

- **Transports over one core (ADR-0022).** The **MCP tools (Claude)** and the **app’s HTTP
  endpoints** are thin transports over the **same core handlers** – capture/read logic is written
  once.
- **Tool conventions (MCP).** Each tool = name + description + JSON Schema `inputSchema` +
  `outputSchema`; return `structuredContent` plus a serialized-JSON text fallback (spec SHOULD, for
  back-compat); use `isError`. Pin the current spec revision **`2025-11-25`** (the tool shape is
  stable across recent revisions).
- **Write.**
  - `capture_enriched(workspace, output{title?, tags[], type, body}, raw?, thread?, idempotency_key?)`
    -> `{id, path, url, applied_tags[]}`. Client pre-enriched (Tier 1); edge normalizes tags
    (core) and commits the note (+ source when `raw` present and distinct).
  - **App/CLI quick-capture** uses the same endpoint with a minimal output (format-only, Tier 0).
  - **Correction surface** (ADR-0026): `append(workspace, id, block)`; `correct(workspace, id, output, base_sha)`;
    `delete(workspace, id, reason?)` / `undo(workspace, capture_id)` – edge-mediated, SHA-conditional,
    recency-scoped; delete/undo remove the note (+ its source) in one commit with an
    `Undo-Of`/`Delete-Of` trailer (ADR-0007).
- **Read.** `list_recent(workspace, since?, limit=20)`; `read_note(workspace, id, include_source=false)`; `list_tags(workspace)`; `list_workspaces()`; `list(workspace, group_by?, filter?, cursor?)` – the faceted grouping tool (ADR-0008). *(Edge: coarse + bounded + GitHub-backed at v1.0/1.1; index-backed and rich at v1.2 — ADR-0009.)*
- **Conventions.** Errors -> **RFC 9457 Problem Details** (media type `application/problem+json`;
  `type/title/status/detail` + a custom `retryable` extension member, paired with a standard
  `Retry-After` header so intermediaries/standard clients see it). Idempotency -> **Idempotency-Key**
  (Stripe semantics; note the IETF `Idempotency-Key` header is an **expired draft, not a ratified
  standard** – cite it as such). On a key replayed with a *different* body, return **422 + Problem
  Details**; document a retention window (24h is a sane default). Pagination -> opaque **cursor**.
- **App sync.** Via **git** (ADR-0010/0022), not a bespoke API; v1 reads+writes ride a simple HTTP
  path through the edge (device git-sync is the C0 / post-MVP upgrade).
- **Init.** One-time scaffold (CLI `init` or edge bootstrap): create `notes/` + `sources/`, write
  the convention version, seed an empty KV vocab, store the PAT + path-secret (Phase 1).
- **Open.** Final field names/shapes.

### ADR-0022. Maximal code & protocol reuse; idiomatic boundaries

**Status:** Accepted (rev 7) - **Slug:** `reuse-and-idioms` - **Tags:** architecture, code, protocol

- **Context.** Maximize reuse of code and protocols across the stack; speak the ecosystem’s idioms
  at every boundary rather than inventing.
- **Decision.**
1. **One core, three runtimes** (ADR-0011): convention/normalization, frontmatter, slug/id, **tag
   normalization**, migrations, the write client, and the FTS search engine all live in the
   shared core and run in the Worker, the CLI, and the app.
1. **One handler set, two transports:** capture/read logic is written once as core functions;
   the **MCP tools** (Claude) and the **app’s HTTP endpoints** are thin adapters over them
   (resolves the ADR-0021 open). The handlers are **origin- and trigger-agnostic** – importers,
   schedulers, and agent hooks are just additional callers (ADR-0029/0030).
1. **One schema, many uses:** define the convention and tool I/O once (e.g. a TS schema that
   emits JSON Schema); reuse it for MCP `inputSchema`/`outputSchema`, HTTP request validation,
   frontmatter validation, and the conformance test.
1. **One write-client *interface*, two backends:** **GitHub REST** (Contents / Git Data API) for
   the **stateless edge** (no clone), and **isomorphic-git** for **clone-holders** (CLI, app).
   Same interface in the core; the runtime picks the backend. (Mirrors the SQLite-driver pattern.)
1. **Git as the device sync protocol:** the app uses isomorphic-git to fetch/pull/push, reusing
   git’s delta protocol and gaining local history – so there is **no bespoke changes-feed/cursor**
   to build (ADR-0010). Pure-JS is viable at our scale (shallow clone; tiny additive files);
   native libgit2 is a benchmark-gated fallback (ADR-0018 #3), not the default.
1. **Idiomatic standard protocols at each boundary:** **MCP** (agent, spec `2025-11-25`), **HTTP +
   RFC 9457 + Idempotency-Key + cursor** (app/integrators), **git** (storage + device sync),
   **OAuth 2.1 / CIMD** (auth, Phase 2). No bespoke protocols anywhere. (Idempotency-Key is an
   expired IETF *draft* + Stripe convention, not a ratified RFC – idiomatic, but not a standard.)
1. **Distributed-but-identical vocab:** tag normalization (core) runs over a vocab that is in KV
   on the edge and a synced copy on the device, so every capture path normalizes the same way.
- **Concrete port choices (rev 13 – build-vs-port audit).** Most of the stack is ported; the genuine
  build is the convention core + two thin seams.
  1. **MCP:** port `@modelcontextprotocol/sdk` + Cloudflare **`createMcpHandler`** (stateless, **no
     Durable Object** – stays inside ADR-0020); write only tool handlers + the shared Zod schemas.
     *Avoid `McpAgent`* (it pulls in DOs).
  2. **Frontmatter:** port the dependency-free **`yaml`** (eemeli); build the ~20-line `---` splitter
     in core (it owns the envelope). Avoid `gray-matter` (Node `Buffer` deps break workerd/RN).
  3. **FTS:** `bun:sqlite` (FTS5 default) on the CLI, `op-sqlite` (FTS5 flag) on the app; edge search
     at v1.2 (ADR-0009). Build **one** shared FTS5 schema + query layer (with frontmatter **facet
     columns** for aggregation, ADR-0008); inject the driver per runtime.
  4. **Conventions:** adopt Obsidian properties + the GBrain compiled-truth/timeline body shape
     (ADR-0005), keeping Croft's ULID id. Don't invent a format.
  5. **Desktop:** build **no desktop UI** – Obsidian + obsidian-git + Dataview/Datacore + Omnisearch
     *is* the desktop surface; Croft's own app exists because obsidian-git is unstable *on mobile*.
  - **The genuine build:** the convention/conformance envelope (ADR-0011/0012), the shared FTS layer,
    and the version-aware write-client interface. Everything around them is off-the-shelf.
- **Consequences.** Less code, fewer drift surfaces, and every boundary is something readers
  (Obsidian), clients (MCP hosts), and integrators (HTTP/git) already speak – alignment is both
  cheaper and more observable. The conformance test (ADR-0011) guards the one place reuse must be
  exact: the convention envelope.

### ADR-0023. CLI packaging & distribution

**Status:** Accepted (rev 9) - **Slug:** `cli-distribution` - **Tags:** distribution, cli, packaging, supply-chain

- **Context.** ADR-0011 specifies a single-binary CLI but not how it reaches developers. The
  audience already lives in the Node / npm / Cloudflare ecosystem (the edge is a Worker deployed
  via wrangler), so distribution should meet them there.
- **Decision.**
  - **npm is the primary discovery + install channel for the CLI:** `npx <cli>` and
    `npm i -g <cli>` – where JS/TS developers look first (the pattern esbuild / turbo / biome use
    even as compiled tools).
  - **Also ship a compiled single binary** via Homebrew + a `curl | sh` installer + GitHub
    Releases, honoring the near-zero-deps promise (ADR-0011) for non-npm users.
  - **Publish with npm provenance attestations** (signed, build-provenance publish) so the supply
    chain is observable – on-ethos for a tool that writes to the user’s GitHub repo (ADR-0001).
  - **`init` is a CLI subcommand** (`<cli> init`, ADR-0021), not a separate `create-*` package.
- **Per-artifact channels (for the record).** App -> App Store / Play Store via Expo EAS; edge
  Worker -> deployed via wrangler (managed) or a self-host template (C0); remote MCP server -> the
  Worker URL added to the client’s MCP config (not a package); shared core -> internal monorepo
  workspace until/unless an SDK is wanted (then a scoped npm package).
- **Consequences.** The npm package name is worth securing but is plumbing under the CLI, not the
  brand’s center of gravity (that is the GitHub org, the domain, the app-store name, and the CLI
  invocation word). Provenance publishing adds a CI step; acceptable. Licensing is open-core /
  source-available non-compete (ADR-0032).

### ADR-0024. Project scaffold: runtime, repo layout, build order

**Status:** Accepted (rev 11) - **Slug:** `project-scaffold` - **Tags:** scaffold, toolchain, phasing

- **Context.** ADRs 0011 / 0023 imply a toolchain but do not pin the runtime, the repo shape, or
  the build order. Decided with the maker’s house standards (Fathom) in mind.
- **Decision.**
  - **Runtime: Bun** for the core, CLI, and Worker dev loop – native single-binary compile
    (ADR-0023) and web-standard APIs (ADR-0011). Workers run on workerd in production; Bun is the
    dev runtime, bundler, test runner, and binary builder.
  - **Repo: one pnpm monorepo, app included** (e.g. `packages/core`, `apps/worker`, `apps/cli`,
    `apps/mobile`). Accept the Metro-vs-Worker build friction in exchange for one source tree and a
    shared core consumed without publishing.
  - **Lint/format: Biome** (house standard); TypeScript strict.
  - **Build order (rev 13): core -> Worker -> (CLI + app, interleaved).** Core first (convention,
    schema, write-client interface, FTS); the Worker next as the MCP tool surface + HTTP – the
    live-dogfood harness (ADR-0013) and the path v1 mobile writes ride. **The app is no longer last:**
    the wedge *is* the connected mobile read/write bridge (ADR-0010/0025) and the dogfood loop isn't
    complete without it, so CLI and app are built together over the same edge, not in series.
- **Consequences.** Bun unifies runtime + bundler + test + single-binary, shrinking the toolchain.
  RN/Expo inside the monorepo is the first scaffolding risk to watch (Metro config, workspace
  hoisting). The app is now **on the critical path** (it is the wedge) but rides an edge it doesn't
  have to build – Worker-before-app still holds.

### ADR-0025. Product wedge & competitive positioning

**Status:** Accepted (rev 13) - **Slug:** `wedge-and-positioning` - **Tags:** positioning, north-star, scope

- **Context.** The category crystallized in 2026 (Karpathy's "LLM wiki" → GBrain at ~22k stars, Basic
  Memory, nanobrain). Croft must state where it is differentiated and where it would be entering a
  crowded lane.
- **Decision – the wedge.** Croft is the **connected mobile read/write notes client** that bridges
  on-the-go capture/reading with a desktop-centric, git-native, agent-enriched workflow. Mobile is
  the differentiated front door; the desktop (Obsidian / Claude / CLI / grep) is the reused workshop;
  plain Markdown in the user's git repo is the wire.
- **Files are the truth (non-negotiable).** The Markdown files are the system of record; every
  index/DB is derivable and disposable (tightens ADR-0001/0009). This is the deliberate inverse of
  GBrain (Postgres = truth, Markdown = projection) and of vendor memory (opaque, in-custody). Do not
  build on / couple to GBrain; stay loosely **convention-compatible** (read its files; don't depend
  on its DB-only graph — Croft doesn't need it, related is computed, ADR-0006).
- **Differentiation, stated.** Hosted-edge MCP (no install) + pure-git ownership + a mobile
  read/write bridge — the combination GBrain/Basic Memory/nanobrain leave empty (all desktop/CLI
  engines with no mobile read client). **Restraint is positioning** (no vector sprawl, no
  arbitrary-edit surface), against a market sprinting toward edit-/vector-heavy agent memory.
- **Complement, not competitor.** **Obsidian** (mid-2026: no AI/agent on its public roadmap; AI is
  community plugins; it trademark-enforced the `mcp-obsidian` rename) is a *reader of the substrate
  Croft writes* — be a feeder, not a rival. **Claude / vendor memory** is vendor-custody, opaque,
  per-vendor — its existence *strengthens* the "your repo, every tool, forever" pitch; position
  Claude as a client that writes into your repo.
- **Watch-list (monitor, don't build).** (1) Obsidian Web Clipper's "Interpreter" creeping toward
  native enrichment; (2) a model vendor shipping an MCP-native, repo/file-backed memory product with
  the ownership framing — the plausible future encroachment (Anthropic's file-based Memory Tool and
  Claude Code's owned-file memory show the category converging on "memory as owned files").
- **Consequences.** The moat is the *combination* + the ethos, not "files as memory" alone (Claude
  Code already does that locally). Targeting people already fully inside Obsidian is the weak spot.

### ADR-0026. Operation vocabulary & bounded mutation

**Status:** Accepted (rev 13) - **Slug:** `operation-vocabulary` - **Tags:** write-path, scope, data-model

- **Context.** "Creates only" (ADR-0004/0015/0020) fit a reader wedge; the read/write-bridge wedge
  (ADR-0010/0025) and dogfooding need a bounded way to add to and clean up content — without opening
  arbitrary collaborative editing.
- **Decision – v1 operation vocabulary.**
  - **capture** — new note (create). Default; conflict-free.
  - **append** — add a dated block to a note's append-only timeline (ADR-0005 body convention).
    Additive; near-conflict-free.
  - **correct** (edit-recent) — targeted SHA-conditional update of a recent note (fixing a fumble).
  - **undo / delete** — remove an erroneous capture as a git delete-commit (note + its source in one
    commit) with an `Undo-Of`/`Delete-Of` trailer (ADR-0007). `undo` = delete-by-`capture_id` within
    a recency window.
- **Why it's safe (and stays cheap).** Recency-scoping keeps it single-writer / just-happened, so
  the conflict surface is ~zero. All correction ops are **edge-mediated SHA-conditional** in v1
  (412 → refetch → reapply), sidestepping device-git divergence (ADR-0010). **Delete/undo don't
  violate observability — they *are* new commits**; history preserves everything (ADR-0007). The
  bright line: edit `HEAD`, never rewrite history.
- **Out of scope.** Arbitrary/historical editing; in-place rewrite of "compiled truth" (the gated
  edit path, ADR-0005); collaborative/real-time editing (no CRDT — single-writer, create-mostly).
- **Consequences.** A complete, on-ethos dogfood loop (capture → append → correct/undo/delete) with
  no new conflict machinery. The conformance envelope (ADR-0011) is unchanged — deletes/edits don't
  touch it.

### ADR-0027. Graceful obsolescence, longevity & revenue posture

**Status:** Accepted (rev 18) - **Slug:** `longevity-and-revenue` - **Tags:** north-star, custody, distribution, cost

- **Context.** A tool that asks you to entrust your knowledge must answer: what happens when the
  operator — or the maker — loses interest?
- **Decision – graceful obsolescence (non-negotiable).** **The operator's *and the maker's*
  disappearance must be a non-event for the user's data.** Every feature must preserve the property
  that the user loses nothing structural if the operator vanishes. The guarantee is **structural,
  not promissory:**
  - Data is already theirs — plain Markdown + git history in their own repo; readable in
    Obsidian/grep/any editor with zero loss on operator death (ADR-0001/0003).
  - The operator is a **processor, not a store** — losing the service costs *convenience*, not the
    corpus; capture falls back to CLI / Claude-direct / hand-editing.
  - Every boundary is a standard (ADR-0022) — the corpus plugs into the whole ecosystem even with
    Croft gone.
  - **The lever: a source-available, self-host-permitted open-core + the C0 self-host template**
    (ADR-0017/0032) — so the tool can be run, forked, and outlive the maker (the non-compete license
    converts to fully open over time). The managed layer is closed; npm-published clients carry
    provenance (ADR-0023).
- **Decision – revenue posture (revised rev 17).** **C0 self-host is free forever** (the trust anchor
  + longevity mechanism; BYO-model, zero operator read). **C1 managed custody is the paid tier** — a
  small flat subscription for convenience (OAuth + one-click App install, hosted MCP), **~$2–5 CAD
  (even $0.99–$2)**; with **BYO-model** its COGS ≈ the Workers floor. **Hosted inference (Tier 2,
  v1.2) is an opt-in C1 convenience** with the guardrails below, included up to a cap or as a higher
  tier so its bounded COGS is covered. **Sell convenience, never access to your own data;** hosted
  inference *is* a paid convenience, but BYO-model stays free-of-inference-charge and **C0 stays
  free**. GitHub Sponsors is a legitimate fourth leg for an OSS developer tool.
- **Hosted-inference guardrails (rev 17).** **Privacy:** opt-in, **no-retention, no-train**,
  **output-observable** (the `Model` trailer + plain-MD result *is* the trust mechanism,
  ADR-0001/0007), scoped to captured content; **C0/BYO is the zero-operator-read floor**. **Cost:**
  light enrichment only (tag/title/classify), small/cheap model (Workers AI or no-retention API),
  per-user caps — ≈ cents/user/month (ADR-0002/0019). **Provider (shippable MVP):** v1.2 ships **one**
  hosted adapter (Workers AI); **BYO = the agent harness** (Tier 1), so no user-facing provider config,
  no per-activity model tiers, no own-hardware — all future adapters behind the extension point
  (ADR-0031 #7).
- **Scope (revised rev 17).** Managed C1 **enters v1** (ADR-0017/0020): **v1.0** dogfood (single-user,
  free) → **v1.1** managed C1 (first paid tier, BYO-model) → **v1.2** hosted inference. Sequenced so
  each step ships and validates; the larger MVP is consciously accepted to have a paid product and
  cover costs.
- **Consequences.** Revenue *need* is low by design, so generosity (free self-host) doesn't bleed. A
  beloved niche end-state is an honest, stable outcome, not a failure — the longevity design makes
  that safe. Accepts an audience-of-few risk consciously.

### ADR-0028. Dependency & risk register

**Status:** Accepted (rev 19) - **Slug:** `dependency-and-risk-register` - **Tags:** risk, architecture, tracking

- **Context.** Make the dependency posture explicit so a fresh session inherits it: where Croft leans
  hard, where it sits on a clean swappable seam, and where a provider's change of shape/stance/support
  is a genuine, un-work-around-able risk.
- **The map.**
  - **Lean hard, clean exit:** **GitHub as data store** (plain MD in your repo → move to
    GitLab/Gitea/self-host anytime; the ethos *is* the exit). **Cloudflare Workers** (core is
    web-standard → portable to Deno/Bun/Node edge; KV swappable; `createMcpHandler` has a
    vendor-neutral transport fallback). **Expo/RN** (the app shell is RN-specific, but the shared
    core survives a shell rewrite).
  - **Clean integration points (swappable):** **MCP** (one-handler-set / two-transports → MCP is an
    adapter, not the spine; HTTP carries the same core). **Claude / enrichment model** (model-agnostic;
    data is model-independent). **SQLite / op-sqlite / bun:sqlite** (FTS5 is standard; portable SQL
    behind a driver interface). **Obsidian** (file-convention compatibility, not an API dependency —
    files stay readable if it vanishes). **Bun** (dev toolchain only; prod is workerd).
  - **External knob you can't remove (but it only ever slows you):** **GitHub API rate limits**
    (ADR-0019) — mitigate by being frugal (batch / backoff).
  - **Corroboration connectors (post-MVP, ADR-0029):** **GitHub history reuses the existing GitHub
    auth — zero new dependency** (the primary artifact source). **Tickets (Jira/Linear) and calendar
    (Google/Outlook)** are each a net-new, swappable connector – keep them **client-side/agent-driven
    (Tier 1) and optional**, so they never compromise operator-as-processor or add a hard dependency.
- **The two genuine risks.**
  1. **isomorphic-git on mobile at scale (post-MVP).** No maintained native-git RN module exists, and
     isomorphic-git has documented packfile-bloat (#2017) in exactly the fetch → merge → re-push loop.
     If its perf doesn't hold, the only escape is a multi-week **native-binding build** (gitoxide /
     libgit2 via uniffi / Nitro), not a swap. *Mitigation (in place):* deferred to post-MVP (v1 rides
     the edge), benchmark-gated (ADR-0018 #3), edge path is a permanent fallback.
  2. **Cloudflare lock-in via discipline erosion** (self-inflicted). Cloudflare changing terms is only
     un-work-around-able if Cloudflare-specific APIs (Durable Objects, proprietary bindings) have
     leaked into the core. *Mitigation:* keep the core web-standard; Cloudflare specifics live in a
     thin adapter (use `createMcpHandler`, not `McpAgent` / DOs, ADR-0022). **Two soft gravity wells
     (rev 19):** **Workers AI** (v1.2 hosted inference) is Cloudflare-specific but sits behind the
     model-provider extension point (ADR-0031), so swappable to a no-retention API at bounded cost;
     **Durable Objects** — the per-tenant **edge-search** index (ADR-0009) **enters v1.2**, so this
     lock-in **deepens in v1** (the stickiest Cloudflare piece). Accepted deliberately for the rich
     managed tier; the index stays derivable/disposable (rebuild-on-wake) and the MCP transport stays
     DO-free (`createMcpHandler`).
- **Guardrails promoted to non-negotiable.** (a) **Core stays web-standard; vendor/runtime specifics
  live in adapters.** (b) **The isomorphic-git mobile benchmark is a gating spike before any
  device-git-sync work.**
- **Consequences.** The ownership ethos keeps the genuine-risk bucket nearly empty by design; the two
  exceptions are deferred and pre-mitigated. Watch-list items (Obsidian Interpreter, vendor
  repo-backed memory) live in ADR-0025.

### ADR-0029. Ingestion, backfill & corroboration

**Status:** Proposed (post-MVP; minimal importer in v1) - **Slug:** `ingestion-and-corroboration` - **Tags:** ingestion, provenance, enrichment, scope

- **Context.** Ownership is bidirectional: a corpus must move *in* as cleanly as it moves out (the
  mirror of graceful obsolescence, ADR-0027). And search/aggregation can't be tuned without corpus
  volume, so some import is needed early.
- **The primitive already exists.** A backfill is capture-at-scale with a different origin: raw lands
  as a `type: context` **source node** (verbatim, observability intact, ADR-0005); the **provenance
  trailer** records the origin (`Imported-From`/`Import-Of`, ADR-0007); enrichment into a `note` is
  optional and Tier-1. So "enrich **or at least** include with provenance" maps directly – provenance
  mandatory, enrichment opt-in. Bulk writes reuse ADR-0019's Git Trees API + tarball path.
- **Decision.**
  - **v1 – a minimal bulk importer** (the maker's own notes → convention envelope + import
    provenance). Its job is to load a real corpus to exercise FTS + faceted aggregation under load
    (ADR-0008/0013); importing through the real write path *is* the volume test of the pipeline.
  - **Post-MVP – format importers** as adapters: GBrain repos (Croft already reads its files),
    vendor-memory exports (Claude/ChatGPT – the ADR-0025 complement made literal), loose Markdown /
    logbooks / daily dumps. Each is a convention→convention mapping into the versioned envelope
    (ADR-0012).
  - **Post-MVP – corroboration, two axes.** **Artifact axis ("what was done"):** GitHub history
    (**primary; reuses the existing GitHub auth – zero new dependency**) → tickets (secondary, richer
    per-item context). **Temporal axis ("when a decision was made"):** calendar (Google/Outlook).
    Corroborating artifacts are themselves **source nodes**; the agent (Tier 1) fetches and
    correlates, the operator only commits – trust budget preserved (ADR-0002/0019).
- **Guardrail (non-negotiable for this surface).** Croft provides the convention + ingestion
  interface + provenance discipline; importers and corroboration connectors are **agent-side,
  optional adapters**. The operator stays a thin processor – **Croft is not an integration platform.**
- **Consequences.** Graceful *onboarding* to match graceful obsolescence. Connector dependency growth
  is tracked in ADR-0028; the primary (GitHub) corroboration source adds none.

### ADR-0030. Context-collection patterns (active capture)

**Status:** Proposed (post-MVP) - **Slug:** `context-collection` - **Tags:** capture, ergonomics, scope

- **Context.** Beyond passive capture, the high-value lever is *proactively* collecting structured
  context – daily summaries, meeting outcomes, project deliveries – by intelligently prompting or
  scheduling.
- **Decision.** A **trigger + prompt-template layer over the existing write surface**, not new
  storage: a daily summary / meeting outcome / project delivery is still a **create or append**
  (ADR-0026). What's new is *when* and *how* capture is invoked:
  - **Triggers:** scheduled (CLI cron, scheduled Worker), event-driven (agent / Claude-Code session
    hooks – nanobrain's session-end hook + idle drainer is the precedent), and mobile reminders /
    notifications.
  - **Prompt templates** per pattern (daily / meeting / project), which the agent fills.
  - All triggers are just **callers of the same capture/append handlers** (ADR-0021/0022) – origin-
    and trigger-agnostic.
- **Consequences.** Reduces capture friction with no new storage concepts and no operator involvement
  (client/agent-driven). The only v1 design hook (already satisfied): a trigger-agnostic capture
  surface.

### ADR-0031. Extension architecture: a closed kernel + typed extension points

**Status:** Accepted (rev 18) - **Slug:** `extension-architecture` - **Tags:** architecture, code, extensibility

- **Context.** Croft grows along several adapter surfaces — write backends, SQLite drivers,
  transports, capture triggers, importers, connectors, model providers. Without a stated pattern they
  proliferate ad-hoc and erode the small-kernel ethos. Name the architecture once so every future
  extension lands the same way.
- **Decision — closed kernel, open edges.** The **core is a small, closed, conformance-guarded
  kernel** (convention/envelope, schema, FTS+facet layer, the write-client *interface*, the handler
  set). Everything that legitimately varies is a **named extension point**: a typed interface the
  runtime or agent injects an adapter into. **The kernel never depends on a concrete adapter.**
- **The extension points (catalogue).**
  1. **Write-client backend** — GitHub REST | isomorphic-git | (future GitLab/Gitea) (ADR-0022).
  2. **SQLite driver** — `bun:sqlite` | `op-sqlite` | wasm (ADR-0011).
  3. **Transport** — MCP | HTTP | (future), over one handler set (ADR-0021/0022).
  4. **Capture caller / trigger** — CLI | agent hook | scheduler | mobile; handlers are
     origin/trigger-agnostic (ADR-0030).
  5. **Format importer** — GBrain | vendor-memory | logbook | markdown; convention→convention
     (ADR-0029).
  6. **Corroboration connector** — GitHub | tickets | calendar; client/agent-side, optional
     (ADR-0029).
  7. **Enrichment model provider** — BYO-client-model | Workers AI | no-retention API; Tier-2
     guardrailed (ADR-0002/0027). **v1.2 ships *one* adapter (Workers AI); BYO is the agent harness
     (Tier 1) — so no user-facing provider config.** Per-activity routing, Bedrock, OpenRouter, and
     own-hardware are future adapters, not MVP.
  8. **Tag vocabulary** — the distributed-but-identical vocab (ADR-0022).
  9. **Frontmatter open-extension** — tolerant pass-through of unknown keys; the data-level extension
     point (ADR-0005).
- **The extension contract (non-negotiable).** Every extension: (a) is an **adapter over a typed core
  interface** — the kernel never imports it; (b) **never mutates the convention envelope** (it
  produces/consumes it; the conformance test guards it, ADR-0011); (c) **emits provenance** — every
  extension write carries a commit trailer naming the importer/model/connector (ADR-0007), so it is
  observable; (d) is **optional** — absence degrades gracefully; (e) **keeps the operator a processor,
  not a store** (connectors/inference are client/agent-side or no-retention, ADR-0029/0027); (f) keeps
  **vendor/runtime specifics in the adapter, never the kernel** (web-standard core, ADR-0028); (g) is
  **versioned** where it touches the convention (ADR-0012).
- **Example surfaces (post-MVP, not v1).** The isomorphic core + origin/trigger-agnostic handlers
  make new *capture surfaces* thin clients over the same edge: a **browser extension** (capture any
  page → note, URL as `source`), **email-in** (Cloudflare Email Workers; forward → note), a **VS Code
  extension** (dev capture). *Electron is skipped — Obsidian is the desktop (ADR-0022).* These are
  reach (validating the architecture), not new scope.
- **Consequences.** Growth happens at the edges without bloating the kernel or weakening the ethos;
  the conformance test + the contract are the guardrails. The genuine build (ADR-0022) is the kernel +
  the interfaces; adapters accrue over time, many of them ported.

### ADR-0032. Licensing & openness: open-core, source-available, non-compete

**Status:** Accepted (rev 18) - **Slug:** `licensing-and-openness` - **Tags:** distribution, custody, licensing, self-host

- **Context.** With a paid C1 tier (ADR-0027) and well-funded adjacent competitors (GBrain, ADR-0025),
  the openness model must simultaneously (a) preserve the graceful-obsolescence guarantee (ADR-0027),
  (b) let anyone self-host / run / fork, yet (c) prevent a competitor from copying the repo and selling
  it as a competing hosted service. OSI-open licenses (MIT/Apache/AGPL) all permit commercial
  rehosting — AGPL only forces sharing *modifications*, not refraining.
- **Decision.**
  - **Open-core (maker-chosen).** The **product is open and self-hostable** — core, CLI, app, the
    self-hostable Worker, the C0 template, the convention. The **managed layer** — multi-tenant control
    plane, billing, custody orchestration — is **closed/private** (not published; needs no copy
    protection because it is never released).
  - **Source-available, self-host-permitted, non-compete** (maker intent: *"running it is fine;
    copying-and-selling is not"*). License the open part under a **source-available non-compete**
    instrument — recommended **FSL (Functional Source License)**, alternatively **BSL 1.1** with a
    self-hosting use-grant — which **converts to Apache-2.0 after ~2 years**. Permits
    self-host / run / modify / fork while forbidding offering it as a competing commercial service
    during the window; the time-conversion preserves long-term openness for graceful obsolescence.
    (Avoid ELv2 / Commons Clause — they never convert.)
  - **Final instrument confirmed at first release** (FSL vs BSL); the *intent* above is the decision.
- **Honest trade-off.** Source-available non-compete is **not OSI "open source"** — a modest
  community/reputation cost and some contributor reticence; an npm-published CLI under a non-OSI
  license may see slightly less adoption. Accepted because the user-facing guarantees that matter
  (run, fork, own your data, longevity) are fully preserved; the restriction binds *competitors*, not
  *users*.
- **Consequences.** ADR-0027's "open-source" wording becomes "source-available, self-host-permitted."
  The graceful-obsolescence guarantee holds: self-host + fork + eventual full-open conversion.
  npm-published clients (ADR-0023) still carry provenance; FSL/BSL/Apache all allow the `npx` / `npm i`
  path. The closed managed layer is the commercial moat alongside the non-compete term.