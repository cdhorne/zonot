# Zonot — Claude Context

Zonot is a **capture → enrichment → ingestion → light-read** layer over plain Markdown in a GitHub
repo the user owns. TypeScript throughout, **Bun** runtime, **one pnpm monorepo**. One isomorphic
**core**; three runtimes: a Cloudflare **Worker** (edge), a Bun **CLI**, and an Expo React Native
**app**. External pitch: **calm on the surface, deep underneath.** Internal design principles:
**power, convenience, trust** — trust comes from observability and ownership, never lockdown or
encryption.

## Source of truth

The full decision record lives in **[`docs/adr/`](docs/adr/)** — 37 ADRs (one file each, per
ADR-0014). This file carries only what must be held in working memory every session. **When this
file and an ADR disagree, the ADR wins** (and fix this file). The `docs/adr/` tree,
`docs/philosophy.md`, and `docs/architecture.md` are hand-authored. The dissolution of the seed
(2026-06-14) retired the seed-as-generator-source model; per-ADR files and the topic docs are
the source of truth.

## Current state

**Seed stage — nothing is built yet.** **Wedge (ADR-0025):** the connected **mobile read/write
bridge** between on-the-go capture/reading and a desktop-centric, git-native, agent-enriched workflow
(files are the truth). **Two audiences keep each other honest (ADR-0025, rev 20):** the **git-native
developer** who brings their own agent (Tier-1 BYO) — observable/ownable is the pitch — **and** a
**naive, no-agent user** who pays the flat C1 fee and wants the app to enrich itself via **Tier-2
hosted inference** — complete/frictionless is the pitch; agent-free onboarding is a first-class design
surface. Build order (ADR-0024): **core → Worker → (CLI + app, interleaved).**

1. **core** — convention/normalization, frontmatter, slug/id, tag normalization, the write-client
   interface, the schema, the SQLite FTS engine.
1. **Worker** — the MCP tool surface + HTTP endpoints; the live-dogfood harness (ADR-0013) and the
   path v1 mobile writes ride, so it comes before the clients.
1. **CLI + app, interleaved** — the app is the wedge, so it is no longer last; both ride the edge.

**v1 is sequenced (ADR-0020):** v1.0 dogfood loop (free/self-host) → v1.1 managed C1 (first paid tier,
~$2–5 CAD; OAuth + GitHub App + billing) → v1.2 guardrailed hosted inference (opt-in Tier-2; the
**completeness lever** for the no-agent tier).

## Non-negotiables

Violating any of these breaks Zonot’s identity. Check against this list before designing anything.

- **Observability is the trust mechanism.** Every write lands as plain Markdown in the user’s own
  repo; raw input is preserved (verbatim at capture, then in git history). The operator is a
  **processor, not a store**. No encryption-as-trust, no lock-in. (ADR-0001)
- **Plain files, user’s repo.** Markdown, one repo per workspace, `notes/YYYY/MM/` +
  `sources/YYYY/MM/`. (ADR-0003)
- **Captures are creates; v1 adds a bounded mutation surface.** New file per note → conflict-free.
  v1 exposes **capture + append + correction (edit / undo / delete)** (ADR-0026 rev 14, available
  at any age — the bound is the op vocabulary, not time). **History rewrite (force-push) stays
  gated**; CRDT/real-time collab stays gated; in-file edit outside the API stays gated.
  Undo/delete are new commits (tidy `HEAD`, never rewrite history).
  (ADR-0004/0015/0026)
- **Git history is the immutability record.** Files are mutable; the audit trail is git. Provenance
  rides in commit trailers, not an in-file array. (ADR-0007)
- **One core enforces the convention.** The conformance test guards exactly one thing: a
  byte-identical convention envelope (frontmatter, slug, id, layout) across runtimes — not enriched
  bodies. (ADR-0011)
- **Convention is versioned** (`v: 1`) from the first capture; changes ship with a forward
  migration in the core. (ADR-0012)
- **Idiomatic protocols at every boundary; no bespoke ones.** MCP (agent), HTTP + RFC 9457 +
  Idempotency-Key + cursor (app/integrators), git (storage + device sync), OAuth 2.1 / CIMD (auth,
  v1.1). (ADR-0022)
- **Git is the device sync protocol** (isomorphic-git) — there is no hand-rolled changes-feed.
  (ADR-0010/0022)
- **Files are the truth; every index/DB is derivable and disposable.** The deliberate inverse of
  DB-as-truth (GBrain) and vendor memory. (ADR-0025)
- **Graceful obsolescence.** The operator's *and the maker's* disappearance must be a non-event for
  the user's data; **source-available, self-host-permitted open-core + C0 self-host** is the mechanism
  (non-compete license, converts to open over time; ADR-0027 §Mechanism). Sell convenience, never access to your
  own data. (ADR-0027 §Mechanism)
- **Core stays web-standard; vendor/runtime specifics live in adapters** (use `createMcpHandler` for
  the MCP transport, not `McpAgent`/DOs; the v1.2 edge-search DO is a separate, deliberate adapter —
  ADR-0009). The isomorphic-git mobile benchmark is a gating spike before any device-git-sync work.
  (ADR-0028)
- **Closed kernel, open edges.** The kernel is small and conformance-guarded; everything that varies
  (backends, drivers, transports, triggers, importers, connectors, model providers) is a typed
  extension point with a uniform contract (provenance, no-envelope-mutation, optional, web-standard).
  (ADR-0031)
- **Hosted inference is opt-in, no-train (contractually verified), retention bounded by upstream
  provider's DPA (mitigation pending per ADR-0037), output-observable;** C0/BYO-model is the
  zero-operator-read floor. For the **naive no-agent user it is the *only* enrichment path** (MCP
  relocates but doesn't remove the model question — ADR-0002) — the **completeness lever** that makes
  the app payable standalone, so it is load-bearing for that tier, not just convenience, while staying
  behind the clean Tier-2 seam for C0/self-host. (ADR-0027/0002/0001/0037)
- **Behavioral privacy → C0.** The content-trust claim is structural at all tiers. Operator-side
  ops telemetry (logs, metrics, Sentry) shows behavior (who did what, when). Self-host (C0) is the
  floor for users who count behavior as in-scope. (ADR-0037)

## Architecture in one breath

One **isomorphic core** (web-standard APIs only) runs in all three runtimes. **One handler set, two
transports**: capture/read logic is written once; the MCP tools and the app’s HTTP endpoints are
thin adapters over it. **One write-client interface, two backends**: GitHub REST for the stateless
Worker, isomorphic-git for clone-holders (CLI, app). **One schema, many uses**: a TS schema emits
JSON Schema reused for MCP I/O, HTTP validation, frontmatter validation, and the conformance test.
Search is SQLite FTS everywhere. Tags are normalized in the core over a distributed-but-identical
vocab (KV on the edge, synced copy on device). (ADR-0022)

## Toolchain & house standards

- **Runtime: Bun** — dev runtime, bundler, test runner, and single-binary builder. Workers run on
  workerd in prod. (ADR-0024)
- **Monorepo: pnpm**, app in-tree (`packages/core`, `apps/worker`, `apps/cli`, `apps/mobile`).
- **Lint/format: Biome** (not ESLint/Prettier). **TypeScript strict.**
- **IDs: ULIDs** (never auto-increment). **Timestamps: ISO-8601 UTC strings** (never Unix ints).
- **App:** Expo React Native (CNG), op-sqlite for on-device FTS — reuse Fathom’s local-first
  patterns. **No on-device models in v1.**
- **Schema:** define once (TS → JSON Schema, e.g. Zod); never duplicate a shape across MCP / HTTP /
  frontmatter / conformance.
- **CLI distribution:** npm (`npx zonot` / `npm i -g zonot`) as primary, plus a compiled Bun
  single binary via Homebrew + curl + GitHub Releases; publish with npm provenance. (ADR-0023)

## Canonical vocabulary

`capture · source · note · thread · tier · reader · agent · workspace`. One canonical
name per concept. **No theming** (no nautical/archive metaphors in code or docs; no Maya glyphs or "sacred well" mysticism; no fantasy/gaming cues. Water-feel in voice and palette, never as overt naming in code).

## Out of scope for v1 — do not build

If a task drifts into these, **stop and flag** rather than gold-plating. (ADR-0020)

- On-*device* enrichment/embedding models · **history rewrite** (force-push protection; the
  five-op correction surface — capture / append / edit / undo / delete — **is** in v1 at any age,
  ADR-0026 rev 14) · **semantic / vector
  search** · C0 direct git sync from the app · rich/custom aggregations. **(Now IN v1, sequenced:
  managed C1 custody + billing at v1.1; guardrailed Tier-2 hosted inference + lexical edge search at
  v1.2 — ADR-0017/0027/0009.)**

## Conventions (grows here)

Record **earned, non-obvious** conventions here as the code teaches them — the gotchas a fresh
session would trip on. Do **not** pre-populate with restatements of decisions; those live in the
ADRs. Known up front:

- **isomorphic-git performance:** never call `status` in a loop (re-parses packfiles — minutes and
  GBs). Use `statusMatrix` with the shared `cache` object. (seed ADR-0010)
- **Device clone is shallow** (`depth: 1`) — the device needs current state, not history; seed from
  an edge-served tarball if the first clone is slow on low-end Android. (ADR-0010)
- **React Native is not browser-CORS-bound** — the app talks to GitHub’s git HTTP directly (use the
  `http/web` client); the Worker is only a fallback proxy. (ADR-0010)
- **Provenance lives in commit trailers**, not note frontmatter (`Source`, `Capture-Id`/`Edit-Of`,
  `Model`, plus `Undo-Of`/`Delete-Of` for the correction surface). (ADR-0007/0026)
- **Cross-package TS resolves from source, not project references.** Consumers import `@zonot/core`
  via `moduleResolution: Bundler` + package `exports` (which point at `./src/*.ts`); keep
  `tsc --noEmit` per package. Do **not** add `composite`/`references` build wiring — `tsc -b` (build
  mode) races with the parallel `tsc --noEmit` checks (lefthook + `pnpm -r`) over the shared
  `.tsbuild`, yielding `TS6305`. A package that calls `.safeParse` on a core schema needs `zod` as a
  direct dep (it's a runtime call, not just a type). (Phase 1)
- **`capture_id := note id` for the capture op.** `undo` (resolves by `capture_id`) and `delete`
  (by `id`) share one by-id resolution path and differ only by intent trailer — no history scan.
  Every later mutation event gets its own fresh `Capture-Id`. (ADR-0026, Phase 1)
- **MCP uses the SDK's web-standard transport directly**, not `agents`' `createMcpHandler`.
  `WebStandardStreamableHTTPServerTransport` (stateless: omit `sessionIdGenerator`) is the same
  DO-free transport `createMcpHandler` wraps, minus the heavy `agents` dep — keeps the Worker
  vendor-neutral (ADR-0022 intent / ADR-0028). Fresh `McpServer`+transport per request (SDK 1.26+).
  (Phase 1; ADR-0022's literal "createMcpHandler" is the wrapper, not a hard requirement.)
- **Worker tree-walk reads (`listRecent`/`listTags`) are O(repo) per call** — they parse note blobs
  on every request because there's no edge index until v1.2 (ADR-0009). Don't build faceted
  `list`/search on this path; it's the deliberate placeholder the materialized index supersedes. (Phase 1)
- **The CLI's local FTS index rebuilds by recreating the db file**, not by clearing rows — FTS5
  contentless tables (`content=''`) don't support `DELETE FROM ftstable` (only per-rowid delete).
  The index is disposable (ADR-0001), so delete-the-file-and-reindex is the simplest correct reset.
  Rebuild is gated on git HEAD moving since the last build (covers commits/pulls, not uncommitted
  working-tree edits). (Phase 2c)
- **op-sqlite's `executeSync` runs only the FIRST statement of a multi-statement string.** bun:sqlite
  and node:sqlite `exec` run all of them; op-sqlite doesn't. So any DDL the mobile adapter executes
  must be a per-statement array (`Outbox` DDL, the mirror `notes` table), looped one `exec` per
  statement — mirroring core's `DDL_STATEMENTS`. (Phase 3b)
- **The mobile local mirror is a `notes` content table + the core FTS index derived from it** — the
  same files→mirror→derived-index shape as the CLI, but with no git clone (C0 device git sync is out
  of v1). The read view needs full note bytes (raw-md / source / backlinks), which the FTS index
  doesn't retain, so `notes` holds them. The tarball seed is deferred (spec §5.4), so in v1.0 the
  mirror only accumulates the user's own captures. (Phase 3c)
- **The note `id` is server-generated** (the capture backend mints the ULID; `CaptureInput` carries
  none). So the device shows a *provisional* optimistic note under a locally-minted id and reconciles
  on ack (`put` the real-id note + `remove` the provisional one) — driven by `SyncWorker`'s `onSynced`
  hook so the worker stays pure/testable. Trust `WriteResult.path` on reconcile (server time can
  bucket the note into a different `notes/YYYY/MM/` than the device-derived path). (Phase 3c/3d)
- **`prepareCapture` (and the other pure op builders) are exposed from `@zonot/core/write-client`** —
  they import only `convention`, never a backend, so the mobile bundle reuses them for byte-identical
  optimistic notes without pulling in isomorphic-git/GitHub REST. The chip parser is at
  `@zonot/core/capture` (`parseCapture`): @thread is **last-wins**, !type first-wins, `!context` is
  rejected with a danger chip (`ChipSpec.invalid`); parse at SAVE, not just the debounced strip, or a
  fast save drops facets (spec §2.2). (Phase 3c/3d)
- **Mobile `tsconfig` must set `allowImportingTsExtensions: true`** — the expo base omits it, but core
  is consumed from source with explicit `.ts` import specifiers (the monorepo source-resolution rule),
  so without it mobile typecheck fails `TS5097`. (Phase 3a)

## Running things

*No scripts yet — populate when the monorepo is scaffolded.* Expected shape:

```bash
bun test                 # core/unit tests
biome check              # lint + format
bun run typecheck        # tsc --noEmit, workspace-wide
wrangler deploy          # from apps/worker
bun build --compile      # CLI single binary
eas build                # from apps/mobile (later)
```

## Workflow

Solo workflow: commit to `main` (PRs only when explicitly requested). For automated/bug-fix tasks:
minimal surgical edits, don’t run build commands, don’t modify CI workflow files.

**Task tracking:** GitHub Issues with a thin convention — templates in `.github/ISSUE_TEMPLATE/`,
full spec in [`docs/workflow/issues.md`](docs/workflow/issues.md). In-progress = assignee + linked
draft PR (`Fixes #N`), **never** an in-issue mutation or a roadmap-file edit.