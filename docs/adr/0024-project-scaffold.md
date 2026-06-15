---
adr: 0024
title: Project scaffold — runtime, repo layout, build order
status: Accepted (rev 11)
slug: project-scaffold
tags: [scaffold, toolchain, phasing]
---

# ADR-0024. Project scaffold: runtime, repo layout, build order

## Context

ADRs 0011 / 0023 imply a toolchain but do not pin the runtime, the repo shape, or the build order. Decided with the maker's house standards (Fathom) in mind.

## Decision

- **Runtime: Bun** for the core, CLI, and Worker dev loop — native single-binary compile (ADR-0023) and web-standard APIs (ADR-0011). Workers run on workerd in production; Bun is the dev runtime, bundler, test runner, and binary builder.
- **Repo: one pnpm monorepo, app included** (e.g. `packages/core`, `apps/worker`, `apps/cli`, `apps/mobile`). Accept the Metro-vs-Worker build friction in exchange for one source tree and a shared core consumed without publishing.
- **Lint/format: Biome** (house standard); TypeScript strict.
- **Build order (rev 13): core -> Worker -> (CLI + app, interleaved).** Core first (convention, schema, write-client interface, FTS); the Worker next as the MCP tool surface + HTTP — the live-dogfood harness (ADR-0013) and the path v1 mobile writes ride. **The app is no longer last:** the wedge *is* the connected mobile read/write bridge (ADR-0010/0025) and the dogfood loop isn't complete without it, so CLI and app are built together over the same edge, not in series.

## Consequences

Bun unifies runtime + bundler + test + single-binary, shrinking the toolchain. RN/Expo inside the monorepo is the first scaffolding risk to watch (Metro config, workspace hoisting). The app is now **on the critical path** (it is the wedge) but rides an edge it doesn't have to build — Worker-before-app still holds.
