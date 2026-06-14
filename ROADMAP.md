# Croft — v1 Delivery Roadmap

> Hand-authored planning artifact (like `CLAUDE.md`); **not** generated from the seed. Derived from
> [`croft-seed.md`](croft-seed.md) **rev 20**. When an ADR changes, update this file. This is the
> input to the agent-sized task breakdown — each phase below is scoped to be handed to agents.

## What "v1 done" means

The **complete dogfood loop** works for the maker, end-to-end, on their own GitHub repo:

> **capture / enrich** (CLI · Claude-via-MCP · phone) → **land as plain Markdown + provenance** in
> your repo → **read / search / lightly aggregate** (phone · Obsidian · grep · CLI) → **correct /
> undo / delete** erroneous content.

It is a thin *vertical* slice, not a broad feature spread (ADR-0020). v1 done = you can live in it
daily across all three runtimes, with a real imported corpus to make search/aggregation meaningful.

**v1 is sequenced (rev 17): v1.0 → v1.1 → v1.2.** The dogfood loop above is **v1.0** (the foundation,
free/self-host — Phases 0–3 below). **v1.1** adds **managed C1** (multi-tenant custody + billing;
first paid tier, BYO-model, ~$2–5 CAD). **v1.2** adds **guardrailed hosted inference** (opt-in
Tier-2) — the **completeness lever** that makes the app payable standalone for the **naive, no-agent
user** (the second of Croft's two audiences, ADR-0025/0027 rev 20; for that user it is the *only*
enrichment path, not a mere convenience). Each ships and validates before the next; the larger MVP is
consciously accepted to have a paid product that covers costs (ADR-0017/0020/0027).

## Build principles (hold across all phases)

- **Build order (ADR-0024): core → Worker → (CLI + app, interleaved).** The app is the wedge
  (ADR-0010/0025), so it is not last — but it rides the edge, so Worker-before-app still holds.
- **Build little, port much (ADR-0022 port choices).** The genuine build is the **convention /
  conformance envelope**, the **shared FTS+facet layer**, and the **write-client interface**.
  Everything else is off-the-shelf: MCP SDK + `createMcpHandler` (no Durable Objects), the `yaml`
  lib, `bun:sqlite` / `op-sqlite` FTS5, Obsidian + plugins for the *entire* desktop surface.
- **Closed kernel, open edges (ADR-0031).** The kernel is small and conformance-guarded; everything
  that varies (backends, drivers, transports, triggers, importers, connectors, model providers) is a
  typed **extension point** with a uniform contract (provenance, no-envelope-mutation, optional,
  web-standard). Grow at the edges, never bloat the kernel.
- **Conformance from day one (ADR-0011).** The byte-identical-envelope test is stood up in Phase 0
  and stays green across CLI + edge for the life of the project.
- **Dogfood from Phase 1 (ADR-0013).** The Worker is the live harness; start capturing real notes
  through it the moment it deploys. Testing *is* dogfooding.
- **Core stays web-standard; vendor/runtime specifics live in adapters (ADR-0028).** Protects the
  edge-portability exit.
- **Writes ride the edge in v1 (ADR-0010).** Device git-sync is the C0 / post-MVP upgrade, so the
  isomorphic-git mobile risk is *off* the v1 critical path.

---

## Phase 0 — Scaffold & convention spine (`packages/core`)

**Goal:** a deterministic, conformance-guarded convention core that every runtime consumes.

- **Build:** the Zod schema (→ JSON Schema, ADR-0022); the convention envelope — ULID `id`, slug,
  frontmatter field discipline (MUST/SHOULD/COULD, ADR-0005), `v: 1` + forward-migration hook
  (ADR-0012), the `notes/YYYY/MM/` + `sources/YYYY/MM/` layout (ADR-0003); the ~20-line `---`
  splitter; tag normalization over the vocab; the **write-client interface** (one interface, two
  backends — stub both, ADR-0022); the **shared FTS5 schema + query/facet layer** (driver-injected).
- **Port:** Bun (runtime/test/bundler), Biome, TS strict; the `yaml` lib (eemeli).
- **Realizes:** ADR-0003/0005/0011/0012/0022.
- **Agent tasks:** (a) monorepo scaffold (pnpm + Bun + Biome, the four workspaces); (b) schema +
  JSON-Schema emit; (c) frontmatter envelope + splitter + ULID/slug; (d) tag-normalization; (e)
  write-client interface + two stub backends; (f) FTS5 schema + facet/query layer; (g) **the
  conformance test harness**.
- **Exit:** core emits and validates a byte-identical note+source envelope; conformance test green;
  ULID/slug/frontmatter fully deterministic.

## Phase 1 — Worker: MCP + HTTP (the live-dogfood harness) (`apps/worker`)

**Goal:** the hosted tool surface that the v1 mobile writes ride and that Claude captures through.

- **Build:** the **handler set once** (write + read core functions); the GitHub REST write backend
  (Contents / Git Data API) — atomic note+source commit with **provenance trailers** (`Source`,
  `Capture-Id`/`Edit-Of`, `Model`, `Undo-Of`/`Delete-Of`, ADR-0007); the operation surface
  (ADR-0026): `capture` (enriched + quick), `append`, `correct`, `undo`/`delete` — SHA-conditional,
  Idempotency-Key, RFC 9457 (ADR-0015/0021); the read surface: `list_recent`, `read_note`,
  `list_tags`, `list_workspaces`, + faceted `list(group_by, filter)` (ADR-0008/0021); `init`
  (scaffold `notes/`+`sources/`, convention version, KV vocab, secrets).
- **Port:** `@modelcontextprotocol/sdk` + Cloudflare **`createMcpHandler`** (stateless, **no DO**);
  wrangler deploy.
- **Auth (Phase 1):** path-secret URL + one fine-grained PAT in a Worker secret; static workspace map
  (ADR-0013). *(OAuth/CIMD/GitHub-App is **v1.1**, not v1.0 — ADR-0017/0020.)*
- **Realizes:** ADR-0007/0013/0015/0021/0022/0026.
- **Agent tasks:** (a) Worker scaffold + `createMcpHandler` wiring; (b) GitHub REST write backend +
  trailers + atomic commit; (c) write handlers (capture/append/correct/undo/delete) over the core;
  (d) read handlers + faceted list; (e) MCP-tool + HTTP-endpoint adapters over the shared handlers;
  (f) `init` bootstrap; (g) path-secret auth + deploy.
- **Exit:** capture/enrich via Claude (MCP), append/correct/undo/delete, and read back — all landing
  as plain MD with provenance in your repo. **Start dogfooding here.**

## Phase 2 — CLI + the test-data importer (`apps/cli`) — interleaved with Phase 3

**Goal:** Tier-0 capture, local FTS/aggregation, and enough corpus volume to tune retrieval.

- **Build:** `croft init`, `croft capture` (Tier 0, direct), read/search/group commands; local FTS
  over the corpus (`bun:sqlite` FTS5 + facet columns, ADR-0008); the **minimal bulk importer**
  (`croft import`): the maker's own notes → convention envelope + `Imported-From` provenance —
  loads a real corpus for search/aggregation testing (ADR-0029/0013).
- **Port:** `bun:sqlite` (FTS5 default); the isomorphic-git write backend (CLI is a clone-holder);
  Bun single-binary compile + npm + provenance (ADR-0023).
- **Realizes:** ADR-0008/0011/0023/0029 (minimal importer slice).
- **Agent tasks:** (a) CLI scaffold + command surface over the core; (b) isomorphic-git backend
  wiring; (c) local FTS + faceted grouping over `bun:sqlite`; (d) the minimal importer; (e)
  single-binary compile + npm-provenance publish pipeline.
- **Exit:** init / capture / import a real corpus / FTS + faceted grouping all work from the CLI.
  Now there is volume to tune ranking and aggregation.

## Phase 3 — Mobile app: the connected read/write bridge (`apps/mobile`) — interleaved with Phase 2

**Goal:** close the loop on the phone — the wedge (ADR-0010/0025).

- **Build:** core screens — capture, browse/search (FTS + faceted grouping), read, **bounded
  correction** (edit-recent/undo/delete, ADR-0026); offline-first **local mirror + capture queue**;
  on-device FTS+facets over the mirror; **writes ride the edge** (capture/append/correct/undo/delete
  via the Worker, SHA-conditional, ADR-0010); secure credential storage (Keychain/Keystore).
- **Port:** Expo RN (CNG), `op-sqlite` (FTS5 flag), Fathom local-first patterns.
- **Realizes:** ADR-0008/0010/0022/0026.
- **Agent tasks:** (a) Expo scaffold (CNG) + op-sqlite + monorepo hoisting; (b) local mirror + capture
  queue (offline-first, durable write ordering); (c) on-device FTS + faceted grouping; (d) the three
  screens + the correction surface; (e) edge write client + secure credential storage.
- **Exit:** capture/read/search/aggregate/correct on the go, syncing through the edge to your repo,
  visible on desktop (Obsidian/grep) and via Claude. **The dogfood loop is closed (v1.0).**

---

## v1.1 / v1.2 — the managed product (after the dogfood loop)

Built on the same core + edge; architected for from day one (multi-tenant + the Tier-2 seam).

### v1.1 — Managed C1 (the first paid tier)
- **Build:** multi-tenant managed custody — OAuth 2.1 + CIMD, the GitHub App (Contents:rw +
  Metadata:r, one repo), per-request short-lived token minting, onboarding (OAuth + one-click install
  on an auto-created repo), billing (ADR-0017). BYO-model (Tier 1) — no operator inference yet.
- **Payment rail (ADR-0018 #11, pending scoping).** Two rails by signup origin, but **sequence
  app-first:** the app's in-app subscription **must** use **app-store IAP** (digital goods; reuse
  Fathom's RevenueCat-replacement backend for receipt validation + entitlement). The **web/CLI rail is
  deferred** until web paid-demand appears — then plug **one** PSP webhook into the *same* entitlement
  store. PSP choice hinges on tax appetite + geography, not processing fee: **Helcim** (Calgary,
  interchange-plus, CAD-native, cheap) if web buyers are mostly Canadian and you own GST/HST; a
  **Merchant-of-Record** (Paddle / Lemon Squeezy) if international web sales matter and you want to
  offload global VAT. *(Verify current terms — processor pricing / MoR rules shift.)*
- **Realizes:** ADR-0017 / 0027. **Exit:** a stranger can sign up, connect their repo, and capture
  via their own Claude — paying ~$2–5 CAD. First external validation + revenue.

### v1.2 — Rich managed tier: hosted inference + edge search (C1)
- **Why it matters (rev 20):** hosted inference is the **completeness lever** for the **no-agent
  user** — the *only* enrichment path when no agent is in the loop (ADR-0002/0025/0027), so it is
  load-bearing for that audience, not optional. The **two halves of v1.2 are separable**: the edge
  search index is model-free / reach-justified; the Workers-AI inference adapter sits behind the clean
  Tier-2 seam (ADR-0031 #7), so C0/self-host keeps the raw + BYO path.
- **Build (hosted inference):** Tier-2 edge enrichment — Workers AI or a no-retention API; **light
  enrichment only** (tag/title/classify); opt-in; **no-retention, no-train**; output = plain MD + a
  `Model` trailer (observable); per-user caps (ADR-0002 / 0019 / 0027).
- **Build (edge search):** the per-tenant materialized index — SQLite **Durable Object**,
  scale-to-zero, rebuild-on-wake (ADR-0009); **lexical** FTS + facet aggregation over the whole
  corpus, so the agent/edge read tools get rich search (not just coarse GitHub-backed reads).
  *Semantic/vectors stay deferred.* **This is where Cloudflare lock-in deepens (the DO; ADR-0028)** —
  accepted for the rich tier; the index stays derivable/disposable and the MCP transport stays DO-free.
- **Realizes:** ADR-0002 / 0009 / 0019 / 0027. **Exit:** the managed tier offers hosted enrichment +
  fast whole-corpus agent search; C0/BYO stays the zero-operator-read floor.

---

## Parallel / cross-cutting

- **Desktop = reuse, build nothing.** Obsidian + `obsidian-git` + Dataview/Datacore + Omnisearch is
  the desktop read/edit/aggregate surface (ADR-0022). Keep frontmatter Obsidian-property-compatible.
- **Spike (parallel, OFF the v1 critical path): the isomorphic-git mobile benchmark** (ADR-0018 #3) —
  `depth:1` clone + pull + push **and** the fetch→merge→re-push loop on a divergent push, ~20–50k
  files, mid-range Android; verify `symlink`/`lstat`. De-risks the **post-MVP** device-git-sync, not
  v1 (v1 rides the edge). Run early so the native-git question (ADR-0028 risk #1) is answered before
  it's load-bearing.
- **Conformance test** green across CLI + edge from Phase 0 onward (ADR-0011).
- **Observability/dogfood** from Phase 1 onward (ADR-0013).

## Suggested agent parallelization

- **Serial spine:** Phase 0 (core) → Phase 1 (Worker). Everything depends on core; v1 writes depend
  on the Worker.
- **Then parallel:** Phase 2 (CLI) and Phase 3 (app) can run as **separate agents** once core +
  Worker exist (both consume the same core + edge). The isomorphic-git benchmark spike runs in
  parallel from the start (it only needs a test corpus + the fs adapter).

## Explicitly NOT in v1

On-*device* enrichment models · arbitrary/historical edit (the *bounded* correction surface **is** in)
· **semantic / vector search** (lexical edge search is IN at v1.2) · device git-sync (C0) · format
importers + corroboration connectors (ADR-0029) · rich/custom aggregations (ADR-0008).

*(Now IN v1 — at v1.1 / v1.2: managed C1 custody + billing, guardrailed Tier-2 hosted inference, and
lexical edge search; ADR-0017 / 0027 / 0009.)*
