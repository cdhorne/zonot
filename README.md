# Zonot

> A clear place to drop your thinking, where everything you keep stays connected
> below the surface. Calm on top, deep underneath.
>
> Plain Markdown in your own GitHub repo. Observable. Yours.
>
> Trust comes from observability and ownership, never lockdown or encryption.

**Status:** seed stage — nothing is built yet. The decision record (35 ADRs, one file each in
[`docs/adr/`](docs/adr/)); the v1 delivery plan in [`ROADMAP.md`](ROADMAP.md); the implementation
contract for Phase 0 in [`docs/specs/core-spec.md`](docs/specs/core-spec.md); for the Worker
runtime in [`docs/specs/worker-spec.md`](docs/specs/worker-spec.md); for Phase 2 (CLI) in
[`docs/specs/cli-spec.md`](docs/specs/cli-spec.md); for Phase 3 (mobile app) in
[`docs/specs/mobile-spec.md`](docs/specs/mobile-spec.md); the working-memory brief loaded into every
collaboration session in [`CLAUDE.md`](CLAUDE.md).

## What it is

A capture-and-read layer over plain files in a GitHub repo you own. TypeScript throughout, **Bun**
runtime, one **pnpm** monorepo, three runtimes — a Cloudflare **Worker** (edge), a Bun **CLI**, and
an Expo React Native **app** — over one isomorphic **core**. Files are the truth; every index/DB is
derivable and disposable. Captures land as plain Markdown + provenance commit trailers in your
repo, where Obsidian, `grep`, and any future agent can read them without going through us.

## The wedge

The connected **mobile read/write bridge** between on-the-go capture and a desktop-centric,
git-native, agent-enriched workflow. Two audiences keep each other honest (ADR-0025):

- The **git-native developer** who brings their own agent (Tier-1 BYO) — observable + ownable is
  the pitch.
- A **naive, no-agent user** who pays the flat fee and wants the app to enrich itself via
  guardrailed, opt-in hosted inference (Tier-2) — complete + frictionless is the pitch.

## v1 sequence

`v1.0` dogfood loop (free / self-host) → `v1.1` managed C1 (~$2–5 CAD; first paid tier, BYO model)
→ `v1.2` guardrailed hosted inference + lexical edge search. Each ships and validates before the
next. See [`ROADMAP.md`](ROADMAP.md).

## Build order

`core → Worker → (CLI + app, interleaved)` — ADR-0024. The app is the wedge, so it is no longer
last; both clients ride the edge.

## Repository layout

Currently in the repo:

- [`docs/adr/`](docs/adr/) — the decision record (35 ADRs, one file each, plus `README.md` index and `CHANGELOG.md`).
- [`docs/brand/brief.md`](docs/brand/brief.md) — the Zonot brand brief (name, pitch, visual direction, voice).
- [`docs/philosophy.md`](docs/philosophy.md) — non-negotiables, ethos, canonical vocabulary.
- [`docs/architecture.md`](docs/architecture.md) — system shape, toolchain, phasing vs. release sequencing.
- [`ROADMAP.md`](ROADMAP.md) — v1 delivery plan.
- [`docs/specs/core-spec.md`](docs/specs/core-spec.md) — core implementation contract (envelope, FTS5,
  `WriteClient`, conformance harness). Hand-authored companion to ADR-0008/0011/0022.
- [`docs/specs/worker-spec.md`](docs/specs/worker-spec.md) — Worker runtime contract (error discipline,
  observability, multi-tenant scaffolding). Hand-authored companion to ADR-0035.
- [`docs/specs/cli-spec.md`](docs/specs/cli-spec.md) — CLI surface contract (command vocabulary, output,
  config, importer, MCP/serve modes). Hand-authored companion to ADR-0036.
- [`docs/specs/mobile-spec.md`](docs/specs/mobile-spec.md) — Phase 3 implementation contract (design system,
  capture surface, sync model, performance budgets). Hand-authored companion to ADR-0034.
- [`CLAUDE.md`](CLAUDE.md) — collaboration brief, working-memory subset of the ADRs.
- `docs/research/` — design investigations and prior-art notes.

Arriving in Phase 0 (per ADR-0024):

- `packages/core/` — the isomorphic convention + schema + FTS engine.
- `apps/worker/` — Cloudflare Worker (MCP + HTTP).
- `apps/cli/` — Bun single-binary CLI.
- `apps/mobile/` — Expo React Native app.

## Licensing

Source-available, self-host-permitted, non-compete ([ADR-0027 §Mechanism](docs/adr/0027-longevity-and-revenue.md#mechanism-source-available-non-compete-licensing)).
Released under the **Functional Source License, Version 1.1, ALv2 Future License**
([`LICENSE`](LICENSE) — FSL-1.1-ALv2). Permits self-hosting, modification, and forking; forbids
offering Zonot as a competing commercial service during the FSL window. **Converts to Apache-2.0**
two years after each release.

The managed control plane (multi-tenant custody, billing) is closed/private — sold as convenience,
never as access to your own data.

## Author

Chris Horne — <cdh612@gmail.com>
