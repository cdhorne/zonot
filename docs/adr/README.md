# Architecture Decision Records

The full decision record. Each file is one ADR (per ADR-0014's one-idea-per-file convention).

| # | Title | Status | Tags |
|---|-------|--------|------|
| [0001](0001-observable-files.md) | Observable plain files are the trust mechanism | Accepted (rev 5) | north-star, custody |
| [0002](0002-three-tier-capture.md) | Three-tier capture; push every interaction to the lowest tier | Accepted (rev 20) | architecture, custody |
| [0003](0003-substrate-and-layout.md) | Substrate — Markdown in the user's GitHub repo, one repo per workspace | Accepted | storage, layout |
| [0004](0004-file-per-note.md) | One file per note; editable in place via a version-aware path | Accepted (rev 4) | storage, concurrency |
| [0005](0005-data-model-note-and-source.md) | Data model — note (record) + conditional source (provenance); both editable | Accepted (rev 16) | data-model |
| [0006](0006-lineage.md) | Lineage — authored note<->source and thread; related is computed; history in git | Accepted (rev 4) | data-model, lineage |
| [0007](0007-git-as-ledger.md) | Git history is the immutability guarantee; provenance in commit trailers | Accepted (rev 5) | git, provenance |
| [0008](0008-search.md) | Search & aggregation — lexical/FTS + faceted views + the agent; edge-semantic deferred | Accepted (rev 20) | retrieval, aggregation |
| [0009](0009-ephemeral-materialization.md) | Content index — ephemeral per-tenant materialization (edge search, v1.2) | Accepted (rev 19) | retrieval, indexing, custody |
| [0010](0010-reader-app.md) | The mobile app — a connected local-first read/write bridge (MVP wedge) | Accepted (rev 13) | app, offline, retrieval |
| [0011](0011-components-and-core.md) | One isomorphic core enforces the convention and owns the engine | Accepted (rev 8) | architecture, code |
| [0012](0012-convention-versioning.md) | Version the note convention from day one | Accepted | data-model, migration |
| [0013](0013-phase-1-deployment.md) | Single-user, remote Worker as the live test harness | Accepted | phasing, auth, hosting, testing |
| [0014](0014-docs-discipline-and-naming.md) | Documentation discipline and naming | Accepted (rev 10) | docs, naming |
| [0015](0015-write-path-atomicity-idempotency.md) | Write path — version-aware; atomicity and idempotency | Accepted (rev 6) | write-path |
| [0016](0016-index-freshness-sync.md) | Index freshness and reader sync | Withdrawn | withdrawn |
| [0017](0017-custody-tiers-auth-distribution.md) | Custody tiers, auth, and distribution | Accepted (rev 17; C1 enters v1 at v1.1) | auth, custody, distribution, self-host |
| [0018](0018-open-questions-register.md) | Open questions register | Open | tracking |
| [0019](0019-cost-and-compute-budget.md) | Cost and trust budget | Accepted (rev 5) | cost, performance, custody |
| [0020](0020-mvp-scope.md) | MVP scope (Phase 1, v1) | Accepted (rev 6) | scope, phasing |
| [0021](0021-tool-and-sync-contract.md) | Tool & sync contract (MVP) | Proposed | api, mcp, app |
| [0022](0022-reuse-and-idioms.md) | Maximal code & protocol reuse; idiomatic boundaries | Accepted (rev 14) | architecture, code, protocol |
| [0023](0023-cli-distribution.md) | CLI packaging & distribution | Accepted (rev 9) | distribution, cli, packaging, supply-chain |
| [0024](0024-project-scaffold.md) | Project scaffold — runtime, repo layout, build order | Accepted (rev 11) | scaffold, toolchain, phasing |
| [0025](0025-wedge-and-positioning.md) | Product wedge & competitive positioning | Accepted (rev 20) | positioning, north-star, scope |
| [0026](0026-operation-vocabulary.md) | Operation vocabulary & bounded mutation | Accepted (rev 14) | write-path, scope, data-model |
| [0027](0027-longevity-and-revenue.md) | Graceful obsolescence, longevity & revenue posture | Accepted (rev 21) | north-star, custody, distribution, cost, licensing, self-host |
| [0028](0028-dependency-and-risk-register.md) | Dependency & risk register | Accepted (rev 19) | risk, architecture, tracking |
| [0029](0029-ingestion-and-corroboration.md) | Ingestion, backfill & corroboration | Proposed (post-MVP; minimal importer in v1) | ingestion, provenance, enrichment, scope |
| [0030](0030-context-collection.md) | Context-collection patterns (active capture) | Proposed (post-MVP) | capture, ergonomics, scope |
| [0031](0031-extension-architecture.md) | Extension architecture — a closed kernel + typed extension points | Accepted (rev 18) | architecture, code, extensibility |
| [0033](0033-billing-and-entitlement.md) | Billing & entitlement architecture | Accepted (rev 22) | billing, distribution, custody, revenue |
| [0034](0034-mobile-app-spec.md) | Mobile app specification | Accepted (rev 6) | app, ux, perf, design, scope |
| [0035](0035-worker-runtime-discipline.md) | Worker runtime — error discipline, observability, multi-tenant scaffolding | Accepted (rev 1) | worker, observability, error-handling, multi-tenant |
| [0036](0036-cli-surface.md) | CLI surface specification | Accepted (rev 1) | cli, ux, scope |
| [0037](0037-threat-model.md) | Threat model and operator data access | Accepted (rev 1) | trust, security, custody, scope |

ADR-0032 (Licensing & openness) was merged into [ADR-0027 §Mechanism](0027-longevity-and-revenue.md#mechanism-source-available-non-compete-licensing) at seed dissolution (2026-06-14). References to ADR-0032 should now point at ADR-0027.

## See also

- [`CHANGELOG.md`](CHANGELOG.md) — evolution of decisions across seed revisions.
- [`../philosophy.md`](../philosophy.md) — non-negotiables, ethos, canonical vocabulary.
- [`../architecture.md`](../architecture.md) — system shape in one breath, toolchain.
- [`../specs/`](../specs/) — hand-authored implementation contracts (core, worker, cli, mobile).
