---
adr: 0011
title: One isomorphic core enforces the convention and owns the engine
status: Accepted (rev 8)
slug: components-and-core
tags: [architecture, code]
---

# ADR-0011. One isomorphic core enforces the convention and owns the engine

## Context

The convention envelope must be byte-identical across runtimes (Worker, CLI, app); the only way to keep that honest is one source of truth + a conformance test.

## Decision

All TypeScript, one codebase. **Shared core** (isomorphic, web-standard APIs only) runs in the Worker, the CLI, and the app. Owns convention/normalization, frontmatter, slug/id, the **write client** (one interface, two backends — ADR-0022), and the FTS engine over a SQLite-driver interface. **CLI** — single binary, no model. **Edge** — Worker: the tool surface (ADR-0021) + (v1.2) the per-tenant DO for edge search (ADR-0009). **App** — core + op-sqlite, no models in v1.

**Conformance test scope:** byte-identical convention envelope (frontmatter, slug, id, file structure) across CLI and edge. Not enriched bodies; not cross-surface search results.

### Conformance test spec

Three layers, one fixture corpus.

1. **Pure-function** layer: each fixture is a JSON file in `packages/core/test/conformance/fixtures/` — `{ input: CaptureInput, expected: { id_recipe, slug, path, frontmatter_bytes, body_split: { compiled, timeline } } }`.
2. **Serialization** layer: the YAML+body bytes match `expected.frontmatter_bytes + expected.body_bytes` exactly, including deterministic key order (MUST: `id, v, created, tags`; SHOULD: `updated, type`; COULD: `aliases, thread, title, workspace, source`; unknown keys pass through in input-order at the tail).
3. **Cross-runtime** layer: the same fixtures run inside the RN JSI runtime via a harness in `apps/mobile/__conformance__/`, asserting byte-identical output on Bun and on Hermes/JSC.

**Coverage areas:** slug edge cases (empty title → id-only; unicode NFC; ≤60-char word-boundary truncation; reserved-filename-char strip; RTL; emoji); frontmatter key order; YAML quoting discipline (ISO-8601 unquoted, ULIDs unquoted, strings with `:`/`#` quoted, tags as block sequence); tag normalization (`["Foo Bar","foo-bar"," FOO_BAR "] → ["foo-bar"]`); body splitter (no divider; divider at start; mid-body; multiple `---` — only the first top-level splits, nested inside fenced code blocks ignored); layout derivation (`created → notes/YYYY/MM/<id>-<slug>.md`); NFC equivalence.

**Out of scope:** enriched body content (model-dependent); cross-runtime search results (tokenizer drift acceptable); commit-trailer formatting (ADR-0007 unit tests); backend-specific commit shape (write-backend unit tests).

**CI gate:** both layers green on every PR that touches `packages/core/`; failure renders a unified byte-diff. Full fixture schema + harness in **[`docs/specs/core-spec.md`](../specs/core-spec.md)**.

## Consequences

Watch Worker weight vs size limits; the core stays kilobytes.
