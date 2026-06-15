# Architecture

## In one breath

One **isomorphic core** (web-standard APIs only) runs in all three runtimes. **One handler set, two transports**: capture/read logic is written once; the MCP tools and the app's HTTP endpoints are thin adapters over it. **One write-client interface, two backends**: GitHub REST for the stateless Worker, isomorphic-git for clone-holders (CLI, app). **One schema, many uses**: a TS schema emits JSON Schema reused for MCP I/O, HTTP validation, frontmatter validation, and the conformance test. Search is SQLite FTS everywhere. Tags are normalized in the core over a distributed-but-identical vocab (KV on the edge, synced copy on device). ([ADR-0022](adr/0022-reuse-and-idioms.md))

The CLI extends this principle: `zonot mcp --stdio` and `zonot serve` add stdio MCP and a local HTTP mirror of the Worker — making it **"one handler set, four transports"** ([ADR-0036](adr/0036-cli-surface.md)). All four read/write through the same core handlers.

## Toolchain & house standards

- **Runtime: Bun** — dev runtime, bundler, test runner, and single-binary builder. Workers run on workerd in prod. ([ADR-0024](adr/0024-project-scaffold.md))
- **Monorepo: pnpm**, app in-tree (`packages/core`, `apps/worker`, `apps/cli`, `apps/mobile`).
- **Lint/format: Biome** (not ESLint/Prettier). **TypeScript strict.**
- **IDs: ULIDs** (never auto-increment). **Timestamps: ISO-8601 UTC strings** (never Unix ints).
- **App:** Expo React Native (CNG), op-sqlite for on-device FTS — reuse Fathom's local-first patterns. **No on-device models in v1.**
- **Schema:** define once (TS → JSON Schema, e.g. Zod); never duplicate a shape across MCP / HTTP / frontmatter / conformance.
- **CLI distribution:** npm (`npx zonot` / `npm i -g zonot`) as primary, plus a compiled Bun single binary via Homebrew + curl + GitHub Releases; publish with npm provenance. ([ADR-0023](adr/0023-cli-distribution.md))

## Build order

`core → Worker → (CLI + app, interleaved)` — [ADR-0024](adr/0024-project-scaffold.md). The app is the wedge ([ADR-0010](adr/0010-reader-app.md)/[ADR-0025](adr/0025-wedge-and-positioning.md)), so it is no longer last; both clients ride the edge, so Worker-before-app still holds.

1. **core** (`packages/core`) — convention/normalization, frontmatter, slug/id, tag normalization, the write-client interface, the schema, the SQLite FTS engine. The genuine build; everything around it is ported.
2. **Worker** (`apps/worker`) — the MCP tool surface + HTTP endpoints; the live-dogfood harness ([ADR-0013](adr/0013-phase-1-deployment.md)) and the path v1 mobile writes ride, so it comes before the clients.
3. **CLI + app, interleaved** (`apps/cli` + `apps/mobile`) — the app is the wedge, so it is no longer last; both ride the edge.

## Release sequence

**v1 is sequenced** ([ADR-0020](adr/0020-mvp-scope.md), [ADR-0027](adr/0027-longevity-and-revenue.md)):

- **v1.0 — dogfood loop** (free/self-host). The complete dogfood loop works for the maker, end-to-end: capture/enrich (CLI · Claude-via-MCP · phone) → land as plain Markdown + provenance in your repo → read/search/lightly aggregate → correct/undo/delete. Single-user (path-secret + your PAT, [ADR-0013](adr/0013-phase-1-deployment.md)).
- **v1.1 — managed C1** (first paid tier, ~$2–5 CAD; BYO model). Multi-tenant managed custody: OAuth 2.1 + GitHub App + per-request short-lived token minting + billing ([ADR-0017](adr/0017-custody-tiers-auth-distribution.md), [ADR-0033](adr/0033-billing-and-entitlement.md)).
- **v1.2 — rich managed tier** (C1). Guardrailed Tier-2 **hosted inference** (opt-in, no-retention, output-observable, small-model + capped; [ADR-0002](adr/0002-three-tier-capture.md)/[ADR-0027](adr/0027-longevity-and-revenue.md)) **+ lexical edge search** ([ADR-0009](adr/0009-ephemeral-materialization.md)) — the per-tenant materialized index over the whole corpus.

Each ships and validates before the next. The larger MVP is consciously accepted to have a paid product that covers costs.

## Phasing vs. release sequencing

Zonot's docs use two parallel naming axes that should not be conflated:

- **Phases 0–3** = build sequence within v1.0 (core → Worker → CLI + mobile). Defined in [ADR-0024](adr/0024-project-scaffold.md). After v1.0 ships, "Phase N" becomes historical; the runtimes are their own names.
- **v1.0 / v1.1 / v1.2** = release sequence (dogfood loop → managed C1 → hosted inference). Defined in [ADR-0020](adr/0020-mvp-scope.md). Ongoing axis; will accrue v1.3+ post-MVP.

When a doc says "Phase 1" it means *the Worker build step*. When it says "v1.1" it means *the first paid managed release*. These can coexist (the Worker exists in both v1.0 and v1.1, but its surface evolves).

## See also

- [`philosophy.md`](philosophy.md) — non-negotiables, ethos, canonical vocabulary, out-of-scope.
- [`adr/`](adr/) — the 35 ADRs, one per file.
- [`specs/`](specs/) — hand-authored implementation contracts (`core-spec.md`, `worker-spec.md`, `cli-spec.md`, `mobile-spec.md`).
