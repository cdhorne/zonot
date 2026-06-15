---
adr: 0023
title: CLI packaging & distribution
status: Accepted (rev 9)
slug: cli-distribution
tags: [distribution, cli, packaging, supply-chain]
---

# ADR-0023. CLI packaging & distribution

## Context

ADR-0011 specifies a single-binary CLI but not how it reaches developers. The audience already lives in the Node / npm / Cloudflare ecosystem, so distribution should meet them there.

## Decision

- **npm is the primary discovery + install channel:** `npx zonot` and `npm i -g zonot` — where JS/TS developers look first (the pattern esbuild / turbo / biome use even as compiled tools).
- **Also ship a compiled single binary** via Homebrew + a `curl | sh` installer + GitHub Releases, honoring the near-zero-deps promise (ADR-0011) for non-npm users.
- **Publish with npm provenance attestations** so the supply chain is observable — on-ethos for a tool that writes to the user's GitHub repo (ADR-0001).
- **`init` is a CLI subcommand** (`zonot init`, ADR-0021), not a separate `create-*` package.

**Per-artifact channels.** App → App Store / Play Store via Expo EAS; edge Worker → deployed via wrangler (managed) or a self-host template (C0); remote MCP server → the Worker URL added to the client's MCP config (not a package); shared core → internal monorepo workspace until/unless an SDK is wanted.

## Consequences

The npm package name is worth securing but is plumbing under the CLI, not the brand's center of gravity. Provenance publishing adds a CI step; acceptable. Licensing is open-core / source-available non-compete (ADR-0027 §Mechanism).
