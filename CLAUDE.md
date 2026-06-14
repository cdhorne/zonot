# Croft — Claude Context

Croft is a **capture → enrichment → ingestion → light-read** layer over plain Markdown in a GitHub
repo the user owns. TypeScript throughout, **Bun** runtime, **one pnpm monorepo**. One isomorphic
**core**; three runtimes: a Cloudflare **Worker** (edge), a Bun **CLI**, and an Expo React Native
**app**. Ethos: **power, convenience, trust** — trust comes from observability and ownership, never
lockdown or encryption.

## Source of truth

The full decision record is **[`croft-seed.md`](croft-seed.md)** — 32 ADRs. This file carries only
what must be held in working memory every session. **When this file and an ADR disagree, the ADR
wins** (and fix this file). The `docs/adr/` tree, `docs/philosophy.md`, and `docs/architecture.md`
are **generated from the seed doc** at `croft init` — don’t hand-edit generated files; change the
seed doc and regenerate.

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

Violating any of these breaks Croft’s identity. Check against this list before designing anything.

- **Observability is the trust mechanism.** Every write lands as plain Markdown in the user’s own
  repo; raw input is preserved (verbatim at capture, then in git history). The operator is a
  **processor, not a store**. No encryption-as-trust, no lock-in. (ADR-0001)
- **Plain files, user’s repo.** Markdown, one repo per workspace, `notes/YYYY/MM/` +
  `sources/YYYY/MM/`. (ADR-0003)
- **Captures are creates; v1 adds a bounded mutation surface.** New file per note → conflict-free.
  v1 exposes **capture + append + correction (edit-recent / undo / delete)** (ADR-0026); arbitrary/
  historical editing stays gated. Undo/delete are new commits (tidy `HEAD`, never rewrite history).
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
  (non-compete license, converts to open over time; ADR-0032). Sell convenience, never access to your
  own data. (ADR-0027/0032)
- **Core stays web-standard; vendor/runtime specifics live in adapters** (use `createMcpHandler` for
  the MCP transport, not `McpAgent`/DOs; the v1.2 edge-search DO is a separate, deliberate adapter —
  ADR-0009). The isomorphic-git mobile benchmark is a gating spike before any device-git-sync work.
  (ADR-0028)
- **Closed kernel, open edges.** The kernel is small and conformance-guarded; everything that varies
  (backends, drivers, transports, triggers, importers, connectors, model providers) is a typed
  extension point with a uniform contract (provenance, no-envelope-mutation, optional, web-standard).
  (ADR-0031)
- **Hosted inference is opt-in, no-retention, no-train, output-observable;** C0/BYO-model is the
  zero-operator-read floor. For the **naive no-agent user it is the *only* enrichment path** (MCP
  relocates but doesn't remove the model question — ADR-0002) — the **completeness lever** that makes
  the app payable standalone, so it is load-bearing for that tier, not just convenience, while staying
  behind the clean Tier-2 seam for C0/self-host. (ADR-0027/0002/0001)

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
- **CLI distribution:** npm (`npx croft` / `npm i -g croft`) as primary, plus a compiled Bun
  single binary via Homebrew + curl + GitHub Releases; publish with npm provenance. (ADR-0023)

## Canonical vocabulary

`capture · source · note · thread · tier · reader · agent · workspace`. One canonical
name per concept. **No theming** (no nautical/archive metaphors in code or docs).

## Out of scope for v1 — do not build

If a task drifts into these, **stop and flag** rather than gold-plating. (ADR-0020)

- On-*device* enrichment/embedding models · **arbitrary/historical edit** (the *bounded* correction
  surface — append / edit-recent / undo / delete — **is** in v1, ADR-0026) · **semantic / vector
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