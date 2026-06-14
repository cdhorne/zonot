# Croft — Seed Decision Record

> Single-document handoff. Name **Croft** — a small plot you own and tend (here, your repo). See
> ADR-0014 for naming status: npm `croft` is free; the GitHub org and domain take a qualifier
> (e.g. `croft-dev`, `croft.app`), and the Lara Croft echo is an accepted brand shadow.
> A capture -> enrichment -> ingestion -> light-read layer over a plain-Markdown corpus the
> user owns. Reading surfaces: a local-first mobile app (in the MVP), Obsidian, GitHub web, grep,
> the CLI. Ethos: **power, convenience, trust** – trust via observability and ownership.

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
Memory / nanobrain now occupy adjacent ground); a glossary defining `register`.

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
- **Consequences.** A derived index is a durable copy – needs to be ephemeral (ADR-0009). The audit
  guarantee lives in git history; force-push protection is a sensible default (ADR-0007), not a hard
  gate. Irreducible floor (managed): the GitHub App private key (ADR-0017); self-host (C0) is the
  only zero-custody option.

### ADR-0002. Three-tier capture; push every interaction to the lowest tier

**Status:** Accepted (rev 3) - **Slug:** `three-tier-capture` - **Tags:** architecture, custody

- **Decision.** **Tier 0** – CLI -> GitHub directly. **Tier 1** – enriched API: client (Claude)
  enriched; edge validates + commits. **Tier 2** – auto-classify: edge runs a model (deferred,
  ADR-0020).
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

**Status:** Accepted (rev 7) - **Slug:** `data-model-note-and-source` - **Tags:** data-model

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
    as a sort key), `v` (convention version, ADR-0012), `created` (ISO-8601), `tags` (a **list** –
    Obsidian-reserved, DC:subject).
  - **SHOULD:** `updated` (earns its place now that correct/edit is in v1), `type` (separates note
    from `source`, drives browse-exclusion; not an Obsidian-reserved key).
  - **COULD:** `aliases` (Obsidian-native; alt-name resolution for the connected/wikilink model),
    `thread` (the one authored edge, ADR-0006), `title` (optional; H1/filename often suffices),
    `workspace`, `source` (an in-file *pointer* to the source node).
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
- **Open (resolved rev 13 with leanings – flagged for maker review).**
  1. **`workspace` field vs repo==workspace (ADR-0003):** *keep* it – cheap, and it makes a note
     self-describing if it ever moves between repos. (Lean: keep.)
  2. **`source` frontmatter pointer vs commit trailer:** *split* – the provenance **event** lives in
     the commit trailer (ADR-0007); an in-file **pointer** to the source node stays in frontmatter
     for Obsidian-link navigation. (Resolve the DC `source` semantic alongside.)
  3. **`created` datetime format:** *ISO-8601 UTC with `Z`* (house standard, portable), leaning on
     the time-ordered ULID for sorting and accepting that Obsidian renders the string as Text. (Lean:
     UTC-`Z`; offset-free would buy native Obsidian Date typing at a portability cost.)

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

### ADR-0008. Search: lexical/FTS plus the agent; edge-semantic deferred

**Status:** Accepted (rev 5) - **Slug:** `search` - **Tags:** retrieval

- **Decision.** **Lexical/tag/FTS, model-free**, and **the agent does the smart part**.
  **Edge-semantic deferred.** In v1 the app runs lexical FTS on-device over its mirror, and Claude
  does agent-augmented search over the read tools – so the edge needs no search engine in v1.
- **Consequences.** v1 retrieval: app FTS + read tools + Obsidian/grep. Server-side indexing
  (ADR-0009) is post-MVP.

### ADR-0009. No durable content index: ephemeral per-tenant materialization (post-MVP)

**Status:** Accepted (rev 5) - **Slug:** `ephemeral-materialization` - **Tags:** retrieval, indexing, custody

- **Decision.** **No persistent fleet-wide content index.** When edge search is needed, materialize
  per-tenant on demand: a **per-tenant Durable Object (SQLite), scale-to-zero, rebuild-on-wake**.
  SQLite-everywhere via the shared core (ADR-0011/0022). Tag vocabulary in KV. All
  derived/rebuildable.
- **Consequences.** Partitioning friction dissolves; cold tenants expose nothing; rebuild-on-wake
  means no freshness problem. Persisted/vector stores are deferred – vectors + ids only, never raw
  bodies.

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
- **Sync via git itself (idiomatic; ADR-0022).** The app holds a clone and uses **isomorphic-git**
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
  (ADR-0021) + (post-MVP) the per-tenant DO. **App** – core + op-sqlite, no models in v1.
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

**Status:** Proposed (Phase 2) - **Slug:** `custody-tiers-auth-distribution` - **Tags:** auth, custody, distribution, self-host

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
1. Auto-classify edge model (Tier 2) – Workers AI vs LLM API.
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
- **Revenue posture (ADR-0027).** Inference is client-side (Tier 1) and storage is the user's repo,
  so operator COGS ≈ the Workers floor – revenue need is low by design; the paid tier sells
  *convenience* (managed custody), never access to your own data.

### ADR-0020. MVP scope (Phase 1, v1)

**Status:** Accepted (rev 6) - **Slug:** `mvp-scope` - **Tags:** scope, phasing

- **In v1.** Shared core (capture + append + bounded correction exposed, ADR-0026); **CLI** (Tier 0);
  **Edge Worker** with the tool surface (ADR-0021); **mobile app** (ADR-0010) – the connected
  **read/write** bridge, no on-device models; GitHub writes via the edge; basic tag normalization;
  one-time repo init (ADR-0021); read/search via app + Obsidian/grep.
- **Deferred.** On-device models; **arbitrary/historical edit** (the *bounded* correction surface is
  in v1); edge search index / per-tenant DO / semantic; Tier-2 auto-classify; **device git-sync
  (C0)**; all of Phase 2.
- **Consequences.** Proves the wedge – a **connected mobile read/write bridge** to your own
  git-native corpus, desktop + phone – as a complete dogfood loop, without the heaviest components.

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
- **Read.** `list_recent(workspace, since?, limit=20)`; `read_note(workspace, id, include_source=false)`; `list_tags(workspace)`; `list_workspaces()`.
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
   (resolves the ADR-0021 open).
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
     deferred (ADR-0009). Build **one** shared FTS5 schema + query layer; inject the driver per runtime.
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
  invocation word). Provenance publishing adds a CI step; acceptable.

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

**Status:** Accepted (rev 13) - **Slug:** `longevity-and-revenue` - **Tags:** north-star, custody, distribution, cost

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
  - **The lever: open-source the core + Worker and ship the C0 self-host template** (ADR-0017) — so
    the tool can be run, forked, and outlive the maker. Permissive license + npm provenance (ADR-0023).
- **Decision – revenue posture.** **Inference is client-side (ADR-0002 Tier 1) and storage is the
  user's GitHub**, so operator COGS ≈ the $5/mo Workers floor (ADR-0019). Therefore: **C0 self-host
  is free forever** (the trust anchor + longevity mechanism); **C1 managed custody is the paid tier**
  — a small flat subscription for convenience (OAuth + one-click App install, hosted MCP, later edge
  search), margin-positive even when cheap. **Sell convenience, never access to your own data; never
  charge for inference** (pay-your-own-model keeps COGS ~zero). GitHub Sponsors is a legitimate
  fourth leg for an OSS developer tool.
- **Consequences.** Revenue *need* is low by design, so generosity (free self-host) doesn't bleed. A
  beloved niche end-state is an honest, stable outcome, not a failure — the longevity design makes
  that safe. Accepts an audience-of-few risk consciously.

### ADR-0028. Dependency & risk register

**Status:** Accepted (rev 13) - **Slug:** `dependency-and-risk-register` - **Tags:** risk, architecture, tracking

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
- **The two genuine risks.**
  1. **isomorphic-git on mobile at scale (post-MVP).** No maintained native-git RN module exists, and
     isomorphic-git has documented packfile-bloat (#2017) in exactly the fetch → merge → re-push loop.
     If its perf doesn't hold, the only escape is a multi-week **native-binding build** (gitoxide /
     libgit2 via uniffi / Nitro), not a swap. *Mitigation (in place):* deferred to post-MVP (v1 rides
     the edge), benchmark-gated (ADR-0018 #3), edge path is a permanent fallback.
  2. **Cloudflare lock-in via discipline erosion** (self-inflicted). Cloudflare changing terms is only
     un-work-around-able if Cloudflare-specific APIs (Durable Objects, proprietary bindings) have
     leaked into the core. *Mitigation:* keep the core web-standard; Cloudflare specifics live in a
     thin adapter (use `createMcpHandler`, not `McpAgent` / DOs, ADR-0022).
- **Guardrails promoted to non-negotiable.** (a) **Core stays web-standard; vendor/runtime specifics
  live in adapters.** (b) **The isomorphic-git mobile benchmark is a gating spike before any
  device-git-sync work.**
- **Consequences.** The ownership ethos keeps the genuine-risk bucket nearly empty by design; the two
  exceptions are deferred and pre-mitigated. Watch-list items (Obsidian Interpreter, vendor
  repo-backed memory) live in ADR-0025.