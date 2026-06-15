# ADR Changelog

Evolution of the decision record across seed revisions 1 → 28. Each entry preserves the
original revision summary; affected ADRs are linked. The seed document was dissolved on
2026-06-14 at rev 28; subsequent decisions are tracked per-ADR.

---

## Threat model + Workers AI contractual ceiling — 2026-06-14

**Added [ADR-0037](0037-threat-model.md) (threat model and operator data access).** Closes the
gap-audit residual on operator data boundaries. Decisions: **(1)** **Data class × tier matrix** —
note content never persisted operator-side at any tier; behavioral metadata (workspace identity,
op type, latency, trace id) is visible to the operator at C1; C0 self-host is the floor for
behavioral privacy. **(2)** **Credential rotation table** for all credential types
(path-secret / GitHub App key / OAuth tokens / IAP receipts / Sentry DSN) with lifetimes,
triggers, and ceremonies. **(3)** **Incident response checklist** anchored on the existing
trace-id propagation + Sync Details forensic surface. **(4)** **Workers AI contractual ceiling
validated:** no-train holds (explicit in CF developer-platform terms §1); **no-retention is silent**
with an "improve the Services" carve-out (§9) — the ADR-0027 marketing claim was an overclaim.
**(5)** **Mitigations** — workspace-name hashing in metrics/Sentry, per-request trace ids without
cross-correlation, Logpush 7-day default, "don't read your own logs" hygiene rule, behavioral-
privacy → C0 disclosure in philosophy.md. **(6)** **Provider stack analysis** — compute stays
Cloudflare (runtime lock-in is a deliberate ADR-0028 trade-off; the matrix shows it touches no
content); AI adapter for v1.2 is the open call between Workers AI with rider vs. Anthropic API
direct (deferred to v1.2 scoping). Bumps **[ADR-0027](0027-longevity-and-revenue.md) to rev 21**
softening the user-facing claim to "no-train (contractually verified), retention bounded by
upstream provider's DPA." Updates [`philosophy.md`](../philosophy.md) (new Trust boundary
section), [CLAUDE.md](../../CLAUDE.md) non-negotiables, [`docs/specs/mobile-spec.md`](../specs/mobile-spec.md)
§9.7 consent modal copy. ADR count **35 → 36.**

---

## Rename — 2026-06-14

Project renamed from **Croft** to **Zonot** per the brand brief at `docs/brand/brief.md`.
Identity-level change: name, URL scheme, package names, CLI binary, repo defaults, env vars,
trace headers, problem URIs. Decisions unchanged — only the surface naming. Semantic tokens
were already neutral (swappable-palette discipline locked at ADR-0034 rev 1) so the brand
absorbs cleanly: palette literals carry the cenote-water flavor; semantic vocabulary stays
generic. Guiding rule from the brief: evoke the imagery, don't invoke the sources — water
imagery is felt in voice and palette, never as overt naming in code.

---

## Rev 28 — 2026-06-14

**Added [ADR-0036](0036-cli-surface.md) (CLI surface specification).** [ADR-0023](0023-cli-distribution.md) covered distribution; the CLI's command vocabulary, output discipline, config layout, and importer shape were left implicit. Decisions: **(1)** **Command vocabulary** — `init / capture / append / correct / undo / delete / read / list / search / tags / workspaces / import / mcp / serve / sync / status / doctor / logs` (mirrors the WriteClient ops + read tools, plus power surfaces). **(2)** **Human-by-default output, JSON when piped or `--json`** — TTY detection drives color + tables + snippets; pipe / `--json` emits NDJSON; `stderr` carries plain text + the trace id; exit codes by class (0/1/2/3/≥10). **(3)** **XDG-aware config layout** (`~/.config/zonot/`, `~/.local/share/zonot/<ws>/`, `~/.cache/zonot/<ws>/`) with `ZONOT_HOME` override. **(4)** **Clone-holder default** (isomorphic-git backend; [ADR-0022](0022-reuse-and-idioms.md) split) with `--worker=URL` opt-in for the managed-backend client mode. **(5)** **`zonot mcp --stdio` ships in v1.0** — the Tier-1 BYO-agent path for desktop devs, exposes the same handlers as the Worker over stdio. **(6)** **`zonot serve` ships in v1.0** — local HTTP mirror of the Worker for C0 self-hosted users so the mobile app can talk to a local CLI as its Worker (lowers the C0 deployment friction). **(7)** **`zonot import`** is the minimal bulk importer per [ADR-0029](0029-ingestion-and-corroboration.md) v1 slice: directory of markdown → convention envelope + `Imported-From` trailer + `sources/` node (per [ADR-0034](0034-mobile-app-spec.md) rev 6 byte-equality rule). **(8)** Error discipline mirrors the Worker (RFC 9457 internally; rendered to stderr/JSON at the boundary); Sentry on the CLI deferred — local crash dump to `$ZONOT_HOME/crashes/<trace_id>.json`. ADR count **35 → 36.** Full surface in [`docs/specs/cli-spec.md`](../specs/cli-spec.md). **The shape grilling cycle is now substantively complete; dissolution of the seed into per-ADR files is the next move.**

---

## Rev 27 — 2026-06-14

**Added [ADR-0035](0035-worker-runtime-discipline.md) (Worker runtime: error discipline, observability, multi-tenant scaffolding).** The Worker had shape ([ADR-0013](0013-phase-1-deployment.md)/[ADR-0021](0021-tool-and-sync-contract.md)/[ADR-0022](0022-reuse-and-idioms.md)) but no runtime trust spec. Decisions: **(1)** **RFC 9457 universal error discipline** with a Zonot-namespaced `type` URI table (`sha-conflict`, `idempotency-replay`, `uninitialized`, `not-found`, `unauthorized`, `rate-limited`, `upstream-rate-limited`, `upstream-down`, `validation`, `internal`) — every response carries a `zonot-trace-id` header (ULID) matched in the problem-body extension. **(2)** **Observability = structured JSON logs (Logpush / `wrangler tail`) + Workers Analytics Engine metrics + Sentry from v1.0** for operator-side crash + error reporting (errors only — no body content, no tags, no titles; [ADR-0001](0001-observable-files.md) governs *content*, not ops health). The user overrode the v1.1 deferral recommendation: solo dogfood can't afford invisible crashes. **(3)** **Multi-tenant scaffolding from v1.0** — explicit `workspace` dispatch on every request, no "default tenant" shortcut, per-`(workspace_hash, op)` rate limiter from day 1, no shared mutable state across workspaces in the Worker. v1.0's static workspace map becomes the v1.1 entitlement-store lookup with no architectural rewrite. **(4)** Cold-start budget honest about the GitHub-REST round-trip being the dominant latency. ADR count **34 → 35**. Full spec in [`docs/specs/worker-spec.md`](../specs/worker-spec.md) (hand-authored companion to [ADR-0035](0035-worker-runtime-discipline.md)).

---

## Rev 26 — 2026-06-14

**Mobile navigation, v1.0 auth, and v1.1/v1.2 auth + onboarding evolution committed.** Bumps **[ADR-0034](0034-mobile-app-spec.md) to rev 5** with: **navigation = two tabs** (`capture` + `browse`; read view is a stack-pushed route at `/note/[id]`, not a tab), full Expo Router file layout, deep-link table, Sheet-primitive use sites; **v1.0 auth = single-screen onboarding** (Worker URL with path-secret + workspace dropdown after `Test connection`), secure-store via the Fathom `keyChain.ts` wrapper, Settings → Auth with sign-out checkboxes (forget creds forced, wipe-mirror optional); **v1.1 onboarding = primary `Sign in with GitHub` CTA + secondary plain link `Self-hosted? Connect a Worker`** (open-core narrative present but not first-screen), OAuth 2.1 + CIMD via ASWebAuthenticationSession, GitHub App install with **auto-created `zonot-notes` repo** as default (with pick-existing option), IAP modal ([ADR-0033](0033-billing-and-entitlement.md)) for billing; **v1.0 → v1.1 migration = none** (existing C0 users keep their path-secret credential); **v1.1 Settings → Auth extension** with GitHub identity / repo / App install / token expiry + proactive refresh / billing card; **v1.2 hosted-inference consent = lazy first-trigger modal, default OFF** (operator-read consent, [ADR-0027](0027-longevity-and-revenue.md)), Settings → Hosted Inference toggle + usage meter + cap-exceeded silent fallback to Tier 0 raw. Full UX in [`docs/specs/mobile-spec.md`](../specs/mobile-spec.md) §8 (navigation) + §9 (auth & onboarding). Mobile branch grilling cycle effectively closed pending one open (source `raw` field policy for mobile captures).

---

## Rev 25 — 2026-06-14

**Edit window unbounded; [ADR-0026](0026-operation-vocabulary.md) reframed.** The "edit-recent" time bound (24h-ish recency) was scope-reducing fiction defended as a positioning commitment; under pressure the mechanics (SHA-conditional + `Edit-Of` trailer + git history immutability) handle edit at any age fine, and the maker called the fiction by its name. **Bumps [ADR-0026](0026-operation-vocabulary.md) to rev 14:** op vocabulary unchanged (capture / append / correct / undo / delete) but `correct` and `undo` no longer carry a recency window — they're available at any age, gated only by SHA-conditional divergence handling. **The bounded surface is now bounded by the *ops*, not by *time*** (no history-rewrite, no CRDT/collab, no arbitrary in-file edit outside the API — all still out). **Bumps [ADR-0034](0034-mobile-app-spec.md) to rev 3:** mobile read-view kebab loses the "edit-recent eligible if…" gating; edit is always available; "Editing window closed — open on desktop" copy retired. **Snackbar undo at 4 seconds post-DURABLE shipped** as the 0-friction same-action regret affordance. Touch points also updated in [ADR-0004](0004-file-per-note.md), [ADR-0010](0010-reader-app.md), [ADR-0015](0015-write-path-atomicity-idempotency.md), [ADR-0021](0021-tool-and-sync-contract.md) (drop "recency-scoped" framing), plus CLAUDE.md and ROADMAP.md "Out of scope" (arbitrary/historical edit removed).

---

## Rev 24 — 2026-06-14

**Added [ADR-0034](0034-mobile-app-spec.md) (mobile app specification)** — the wedge surface is no longer "TBD beyond [ADR-0010](0010-reader-app.md)". A grilling cycle on 2026-06-14 closed the seven load-bearing mobile decisions in one ADR: **(1)** design system = lifted Fathom Restyle scaffolding with neutral two-tier swappable tokens, **(2)** capture = launch-on-capture tab, single-input parse-on-save with inline `#tag`/`@thread`/`!type` syntax, reactive debounced chip strip (leave-in-body for Obsidian compat), **(3)** capture entry points sequenced v1.0 (in-app + URL scheme) → v1.1 (Share Sheet + Share Intent + Control Center + widgets, iOS-primary) → v1.2 (voice), **(4)** save = dual-affordance (button + swipe-down), **(5)** sync state model = two states (durable / synced) with quiet failure discipline and a Settings → Sync details forensic screen, **(6)** performance budgets with concrete numbers per operation, **(7)** reference devices = iPhone 12 / SE 3 (iOS floor), maker's daily iPhone (measurement target), Pixel 6a (Android floor; CI/emulator only at v1.0 — maker is iOS-only). ADR count **33 → 34**. Full spec + budget table + token vocabulary in [`docs/specs/mobile-spec.md`](../specs/mobile-spec.md). Phase 3 (mobile app) is now scopable.

---

## Rev 23 — 2026-06-14

**Phase 0 unblocked: the FTS5 schema, the write-client interface, and the conformance test are now spec'd, not deferred.** Bumps **[ADR-0008](0008-search.md)** (rev 20: concrete FTS5 + facet-meta schema, `unicode61 remove_diacritics 2` tokenizer, driver-injected per runtime), **[ADR-0011](0011-components-and-core.md)** (rev 8: fixture-driven conformance with three layers — pure-function, serialization, cross-runtime — and the explicit out-of-scope list), and **[ADR-0022](0022-reuse-and-idioms.md)** (rev 14: the `WriteClient` interface, the SHA-conditional error contract, idempotency replay rules, and core-owned provenance-trailer generation). Full DDL and TypeScript signatures live in [`docs/specs/core-spec.md`](../specs/core-spec.md) (hand-authored, not seed-generated). With these, the Phase 0 agent tasks (a)–(g) in ROADMAP.md become individually pickup-able; the seed-to-implementation handoff is no longer a design-by-coding gamble.

---

## Rev 22 — 2026-06-14

**Resolved [ADR-0033](0033-billing-and-entitlement.md)'s two open billing decisions.** (1) **Hosted-inference packaging = opt-in *included cap* on C1, one SKU** (not a separate tier): off by default (operator-read consent), included up to a monthly cap when enabled, so the naive user gets a complete app with no second purchase; **cap-exceeded never blocks capture — it lands raw (Tier 0)**, only enrichment degrades ([ADR-0004](0004-file-per-note.md)). Tightens [ADR-0027](0027-longevity-and-revenue.md). (2) **Entitlement lifecycle:** generous grace (honor store/PSP native billing-grace + smart-retry; entitlement active through grace) + **clean revoke on refund/chargeback**. Bright line: **billing state gates only the managed convenience — never the user's data or the C0 path** ([ADR-0001](0001-observable-files.md)/[ADR-0027 §Mechanism](0027-longevity-and-revenue.md#mechanism-source-available-non-compete-licensing)). [ADR-0033](0033-billing-and-entitlement.md)'s lone remaining Open is the web-rail instrument (Helcim vs MoR).

---

## Rev 21 — 2026-06-14

**Added [ADR-0033](0033-billing-and-entitlement.md) (billing & entitlement architecture)** — promotes the rev-20 payment-rail note to a full decision. **One server-authoritative entitlement store is the spine; payment sources are adapters** (mirrors [ADR-0031](0031-extension-architecture.md)), keyed to the **Zonot account** ([ADR-0017](0017-custody-tiers-auth-distribution.md)) so app + web is one entitlement, and encoding the **tier** (custody-only vs +hosted-inference, [ADR-0027](0027-longevity-and-revenue.md)). **App rail = mandatory app-store IAP** (Apple/Google also collect tax + take the 15% small-business cut — reuse Fathom's RevenueCat-replacement backend for receipt validation + store server-notifications); the **web/CLI PSP/MoR rail is deferred** (Helcim if mostly-Canadian; a Merchant-of-Record if international). **Billing is operator-side only — it never touches the user's repo** ([ADR-0001](0001-observable-files.md)), so graceful obsolescence holds (losing C1 costs convenience, not data; C0 stays free, [ADR-0027 §Mechanism](0027-longevity-and-revenue.md#mechanism-source-available-non-compete-licensing)). ADR count **32 → 33**; [ADR-0018](0018-open-questions-register.md) #11 now points to [ADR-0033](0033-billing-and-entitlement.md); fixed an [ADR-0022](0022-reuse-and-idioms.md) fossil (auth is **v1.1**, not "Phase 2").

---

## Rev 20 — 2026-06-14

**Dual-audience model made explicit; hosted inference reframed from *convenience* to *completeness lever*.** Zonot deliberately serves **two audiences that keep each other honest:** the **git-native developer** who brings their own agent (Tier-1 BYO over MCP — the [ADR-0025](0025-wedge-and-positioning.md) wedge) and a **naive, no-agent user** who pays the flat C1 fee and wants the app to enrich itself (the maker's less-technical peers are the test cohort). For the no-agent user, **Tier-2 hosted inference (v1.2) is the *only* path to enrichment** — BYO-agent, app-as-MCP-host-with-BYO-key, and deferred on-device models all require the user to *bring* a model, and on-device *embedding* is search, not enrichment — so it is **load-bearing, not optional** for that tier, while staying behind the clean Tier-2 extension seam ([ADR-0031](0031-extension-architecture.md) #7) for C0/self-host. Amends **[ADR-0002](0002-three-tier-capture.md)** (enrichment locus: where the model lives; MCP relocates, doesn't remove, the model question), **[ADR-0025](0025-wedge-and-positioning.md)** (two audiences; a deliberate, modest consumer-ward repositioning), **[ADR-0027](0027-longevity-and-revenue.md)** (hosted inference = completeness lever for the no-agent tier; the highest-margin user). Clarified **[ADR-0010](0010-reader-app.md)** (the on-device *deferral* is narrow — only the models; on-device FTS/facets/mirror are in v1). Added **[ADR-0018](0018-open-questions-register.md) #11** (payment rail: app-store IAP for app signups + a self-hosted subscription backend for web/CLI/C0; billing scoping pending).

---

## Rev 19 — 2026-06-14

**Edge search moved into v1 at v1.2** (with hosted inference) — the managed **rich tier** ([ADR-0020](0020-mvp-scope.md)): the per-tenant materialized **lexical** FTS + aggregation index ([ADR-0009](0009-ephemeral-materialization.md)) gives the agent/edge rich whole-corpus search; semantic/vectors stay deferred. v1.0/1.1 search stays device-FTS + Obsidian + agent-over-coarse-edge-tools ([ADR-0008](0008-search.md)/[ADR-0021](0021-tool-and-sync-contract.md)). Honest consequence: the per-tenant **Durable Object** enters v1.2, so the one real **Cloudflare lock-in deepens** ([ADR-0028](0028-dependency-and-risk-register.md)) — accepted for the rich tier; the index is derivable/disposable and the MCP transport stays DO-free.

---

## Rev 18 — 2026-06-14

Openness, providers, surfaces, edge-portability. **Added ADR-0032 (licensing & openness)** — since merged into [ADR-0027 §Mechanism](0027-longevity-and-revenue.md#mechanism-source-available-non-compete-licensing) at rev 28 dissolution. **open-core** (product open + self-hostable; managed layer closed) under a **source-available, self-host-permitted, non-compete** license (recommended **FSL/BSL**, converts to Apache-2.0 over ~2 years) — *run it freely, don't copy-and-sell it*; revises [ADR-0027](0027-longevity-and-revenue.md)'s "open-source" wording. **Provider (shippable MVP):** v1.2 ships one hosted adapter (Workers AI); BYO = the agent harness; no provider-picker / per-activity tiers / own-hardware ([ADR-0027](0027-longevity-and-revenue.md)/[ADR-0031](0031-extension-architecture.md) #7). **Novel surfaces** named as extension examples — browser extension, email-in, VS Code ([ADR-0031](0031-extension-architecture.md)). **Cloudflare** is convenient, not load-bearing; two soft gravity wells noted (Workers AI, Durable Objects; [ADR-0028](0028-dependency-and-risk-register.md)).

---

## Rev 17 — 2026-06-14

Pulled the **managed-convenience model into v1** and added the **extension architecture**. Revenue ([ADR-0027](0027-longevity-and-revenue.md)) revised: managed **C1 enters v1** (no longer Phase 2) and **hosted inference (Tier 2) is an opt-in C1 convenience** with cost + privacy guardrails (opt-in, no-retention, no-train, output-observable; small-model + capped) — reversing rev-15's "no paid tier / never charge for inference." **v1 is sequenced: v1.0 dogfood → v1.1 managed C1 (paid, ~$2–5 CAD) → v1.2 hosted inference** ([ADR-0020](0020-mvp-scope.md)); a consciously larger MVP. Un-deferred **Tier 2** ([ADR-0002](0002-three-tier-capture.md)), moved **[ADR-0017](0017-custody-tiers-auth-distribution.md) custody/auth into v1**, resolved **[ADR-0018](0018-open-questions-register.md) #5** (Workers AI / no-retention API), added Tier-2 COGS guardrails ([ADR-0019](0019-cost-and-compute-budget.md)) and a trust-rule bullet ([ADR-0001](0001-observable-files.md)). **Added [ADR-0031](0031-extension-architecture.md): extension architecture** (closed kernel + typed extension points). ROADMAP + CLAUDE.md synced.

---

## Rev 16 — 2026-06-14

Confirmed the core frontmatter field set ([ADR-0005](0005-data-model-note-and-source.md)): `type` is an open note-kind vocabulary (reserved `context` for source nodes), `thread` a single slug in v1, `source` a single ULID pointer in v1, and a minimal v1 tag-normalization (lowercase/trim/hyphenate/dedupe). Serialization, key order, and slug-derivation are deferred to Phase 0 under the conformance test. **Revenue (rev 15) reopened for refinement** — hosted inference vs pay-your-own-model, and whether the target MVP includes the managed-convenience tier (pricing ~$2–5 CAD or less) — pending.

---

## Rev 15 — 2026-06-14

Landed the **revenue decision** ([ADR-0027](0027-longevity-and-revenue.md)): the *posture* is Accepted — free C0 self-host forever; paid C1 = convenience; never charge for data or inference; client-side inference keeps operator COGS ≈ the Workers floor — while the **C1 mechanism rides [ADR-0017](0017-custody-tiers-auth-distribution.md) (Phase 2)** and **v1 ships no paid tier** (Phase 1 = single-user self-host, [ADR-0013](0013-phase-1-deployment.md)), so revenue is off the v1 critical path. (Frontmatter-schema precision is being calibrated separately — [ADR-0005](0005-data-model-note-and-source.md).)

---

## Rev 14 — 2026-06-14

Captured two growth vectors and a read mode after the wedge review. **Added** [ADR-0029](0029-ingestion-and-corroboration.md) (ingestion, backfill & corroboration — the mirror of graceful obsolescence; a **minimal bulk importer enters v1** as the search/aggregation test-data enabler, [ADR-0020](0020-mvp-scope.md)/[ADR-0013](0013-phase-1-deployment.md); format importers + the two-axis corroboration model — GitHub-primary artifact axis reusing existing auth, calendar temporal axis, tickets secondary — stay post-MVP) and [ADR-0030](0030-context-collection.md) (context-collection patterns — active/scheduled/prompted capture as a trigger layer over the same handlers). **Extended** [ADR-0008](0008-search.md) with **faceted aggregation** (a sibling read mode over frontmatter facets; light grouping in v1, rich post-MVP). **Updated** [ADR-0022](0022-reuse-and-idioms.md) (handlers are origin/trigger-agnostic) and [ADR-0028](0028-dependency-and-risk-register.md) (corroboration connectors as optional, client-side dependencies).

---

## Rev 13 — 2026-06-14

Scope-reconciliation pass after the prior-art + wedge review. **Wedge locked:** Zonot is the *connected mobile read/write notes client* that bridges on-the-go capture/reading with a desktop-centric, git-native, agent-enriched workflow; **files are the truth** (the inverse of GBrain's DB-as-truth projection). **Scope amended** ([ADR-0004](0004-file-per-note.md)/[ADR-0010](0010-reader-app.md)/[ADR-0015](0015-write-path-atomicity-idempotency.md)/[ADR-0020](0020-mvp-scope.md)): v1 is creates **+ append + a bounded correction surface** (edit-recent / undo / delete); mobile is **read/write** (v1 writes ride the edge; device git-sync is the C0 / post-MVP ownership upgrade). **Build order reordered** ([ADR-0024](0024-project-scaffold.md)) so the app is no longer strictly last. **Added** [ADR-0025](0025-wedge-and-positioning.md) (wedge & positioning), [0026](0026-operation-vocabulary.md) (operation vocabulary & bounded mutation), [0027](0027-longevity-and-revenue.md) (graceful obsolescence, longevity & revenue), [0028](0028-dependency-and-risk-register.md) (dependency & risk register). **Resolved** [ADR-0018](0018-open-questions-register.md) #8 (edge-first sync) and #10 (edge SHA-conditional edit policy); **settled** the [ADR-0005](0005-data-model-note-and-source.md) field set (minimal-core / open-extension) and adopted the compiled-truth + append-only-timeline body shape; **folded** concrete port choices into [ADR-0022](0022-reuse-and-idioms.md); **added** a Glossary; **dropped** the undefined `register` from the canonical set. Three frontmatter tensions are resolved with leanings and flagged for review ([ADR-0005](0005-data-model-note-and-source.md) Open).

---

## Rev 12 — 2026-06-14

Prior-art / standards review pass (no strategy change). Corrected standards citations in **[ADR-0021](0021-tool-and-sync-contract.md)/[ADR-0022](0022-reuse-and-idioms.md)** (Idempotency-Key is an expired IETF *draft*, not a ratified standard; pinned the MCP spec revision `2025-11-25`) and refined the **[ADR-0005](0005-data-model-note-and-source.md)** precedents (Dublin Core `source`/`relation` semantics; Obsidian datetime typing). Added a **sync-divergence guard** — non-fast-forward = hard stop, fetch -> merge -> re-push, conflict-copy-as-create, secure on-device credential — to **[ADR-0010](0010-reader-app.md)/[ADR-0015](0015-write-path-atomicity-idempotency.md)**, and expanded the **[ADR-0018](0018-open-questions-register.md) #3** benchmark spec. Open follow-ups left for the maker: resolve the [ADR-0005](0005-data-model-note-and-source.md) field set; a competitive-positioning ADR (GBrain / Basic Memory / nanobrain now occupy adjacent ground); a glossary defining `register`. *(All addressed in rev 13/14.)*

---

## Rev 11 — 2026-06-07

Added **[ADR-0024](0024-project-scaffold.md): project scaffold** — Bun runtime (core/CLI/Worker dev + single-binary build), one pnpm monorepo with the app in-tree, Biome, and build order core -> Worker -> CLI -> app. Hand-authored `CLAUDE.md` produced alongside (the one non-generated seed file).

---

## Rev 10

Rename to Zonot + seeding model ([ADR-0014](0014-docs-discipline-and-naming.md)). Name due diligence: rejected goat notes (taken; GoodNotes phonetic clash), Cairn (adjacent agent-on-your-GitHub-repos project), and Trig (W3C `.trig` clash). Zonot chosen — small plot you own and tend; npm `zonot` free; qualifier needed on GitHub org and domain; Lara Zonot accepted as out-of-class brand shadow.

---

## Rev 9

CLI distribution decided ([ADR-0023](0023-cli-distribution.md)). npm primary discovery (`npx`, `npm i -g`); compiled single binary via Homebrew + `curl | sh` + GitHub Releases; npm provenance attestations; `init` is a subcommand.

---

## Rev 8

isomorphic-git verdict ([ADR-0010](0010-reader-app.md)/[ADR-0022](0022-reuse-and-idioms.md)). Pure-JS isomorphic-git is viable at Zonot's scale for the post-MVP device-sync path; native libgit2 only behind a gating benchmark.

---

## Rev 7

Reuse pass + precedents. The build-vs-port audit landed in [ADR-0022](0022-reuse-and-idioms.md): port `@modelcontextprotocol/sdk` + `createMcpHandler`, `yaml`, `bun:sqlite` / `op-sqlite` FTS5, Obsidian + obsidian-git + Dataview/Datacore for desktop. Build only the convention/conformance envelope, the shared FTS layer, the version-aware write client.

---

## Rev 6

App-in-MVP. The mobile app is no longer post-MVP; it is the wedge ([ADR-0010](0010-reader-app.md)/[ADR-0025](0025-wedge-and-positioning.md)).

---

## Rev 5

Prune. Consolidation pass on the decision record; multiple ADRs simplified.

---

## Revs 1–4

Initial seed: the trust model ([ADR-0001](0001-observable-files.md)), the three-tier capture ladder ([ADR-0002](0002-three-tier-capture.md)), the substrate ([ADR-0003](0003-substrate-and-layout.md)), file-per-note ([ADR-0004](0004-file-per-note.md)), the data model ([ADR-0005](0005-data-model-note-and-source.md)), lineage ([ADR-0006](0006-lineage.md)), git as the ledger ([ADR-0007](0007-git-as-ledger.md)), search shape ([ADR-0008](0008-search.md)), ephemeral materialization ([ADR-0009](0009-ephemeral-materialization.md)), the mobile-as-reader idea (later evolved to read/write bridge, [ADR-0010](0010-reader-app.md)), one isomorphic core ([ADR-0011](0011-components-and-core.md)), convention versioning ([ADR-0012](0012-convention-versioning.md)), Phase 1 deployment ([ADR-0013](0013-phase-1-deployment.md)).
