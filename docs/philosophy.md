# Philosophy

Zonot is a calm surface over a deep, connected store. The capture is simple, quiet, and uncluttered; everything you keep settles into one navigable system underneath. Trust comes from observability and ownership — every note is plain Markdown in your own repo; the operator is a processor, not a store.

## What Zonot is

Zonot is a **capture → enrichment → ingestion → light-read** layer over plain Markdown in a GitHub repo the user owns. Surfaces: a local-first mobile app (in the MVP), Obsidian, GitHub web, `grep`, the CLI. The agent (Claude over MCP) enriches captures; the repo is the system of record. External pitch: **calm on the surface, deep underneath.** Internal design principles: **power, convenience, trust** — trust via observability and ownership.

## The wedge

The connected **mobile read/write bridge** between on-the-go capture/reading and a desktop-centric, git-native, agent-enriched workflow (files are the truth — [ADR-0025](adr/0025-wedge-and-positioning.md)). Mobile is the differentiated front door; the desktop (Obsidian / Claude / CLI / grep) is the reused workshop; plain Markdown in the user's git repo is the wire.

**Two audiences keep each other honest** ([ADR-0025](adr/0025-wedge-and-positioning.md), rev 20):

- The **git-native developer** who brings their own agent (Tier-1 BYO over MCP) — observable/ownable is the pitch.
- A **naive, no-agent user** who pays the flat C1 fee and wants the app to enrich itself via **Tier-2 hosted inference** ([ADR-0027](adr/0027-longevity-and-revenue.md)) — complete/frictionless is the pitch; agent-free onboarding is a first-class design surface.

The two audiences cross-check scope and honesty: the developer keeps it observable/ownable; the civilian keeps it complete and frictionless.

## Non-negotiables

Violating any of these breaks Zonot's identity. Check against this list before designing anything.

- **Observability is the trust mechanism.** Every write lands as plain Markdown in the user's own repo; raw input is preserved (verbatim at capture, then in git history). The operator is a **processor, not a store**. No encryption-as-trust, no lock-in. ([ADR-0001](adr/0001-observable-files.md))
- **Plain files, user's repo.** Markdown, one repo per workspace, `notes/YYYY/MM/` + `sources/YYYY/MM/`. ([ADR-0003](adr/0003-substrate-and-layout.md))
- **Captures are creates; v1 adds a bounded mutation surface.** New file per note → conflict-free. v1 exposes **capture + append + correction (edit / undo / delete)** ([ADR-0026](adr/0026-operation-vocabulary.md) rev 14, available at any age — the bound is the op vocabulary, not time). **History rewrite (force-push) stays gated**; CRDT/real-time collab stays gated; in-file edit outside the API stays gated. Undo/delete are new commits (tidy `HEAD`, never rewrite history). ([ADR-0004](adr/0004-file-per-note.md)/[ADR-0015](adr/0015-write-path-atomicity-idempotency.md)/[ADR-0026](adr/0026-operation-vocabulary.md))
- **Git history is the immutability record.** Files are mutable; the audit trail is git. Provenance rides in commit trailers, not an in-file array. ([ADR-0007](adr/0007-git-as-ledger.md))
- **One core enforces the convention.** The conformance test guards exactly one thing: a byte-identical convention envelope (frontmatter, slug, id, layout) across runtimes — not enriched bodies. ([ADR-0011](adr/0011-components-and-core.md))
- **Convention is versioned** (`v: 1`) from the first capture; changes ship with a forward migration in the core. ([ADR-0012](adr/0012-convention-versioning.md))
- **Idiomatic protocols at every boundary; no bespoke ones.** MCP (agent), HTTP + RFC 9457 + Idempotency-Key + cursor (app/integrators), git (storage + device sync), OAuth 2.1 / CIMD (auth, v1.1). ([ADR-0022](adr/0022-reuse-and-idioms.md))
- **Git is the device sync protocol** (isomorphic-git) — there is no hand-rolled changes-feed. ([ADR-0010](adr/0010-reader-app.md)/[ADR-0022](adr/0022-reuse-and-idioms.md))
- **Files are the truth; every index/DB is derivable and disposable.** The deliberate inverse of DB-as-truth (GBrain) and vendor memory. ([ADR-0025](adr/0025-wedge-and-positioning.md))
- **Graceful obsolescence.** The operator's *and the maker's* disappearance must be a non-event for the user's data; **source-available, self-host-permitted open-core + C0 self-host** is the mechanism (non-compete license, converts to open over time; [ADR-0027 §Mechanism](adr/0027-longevity-and-revenue.md#mechanism-source-available-non-compete-licensing)). Sell convenience, never access to your own data. ([ADR-0027](adr/0027-longevity-and-revenue.md))
- **Core stays web-standard; vendor/runtime specifics live in adapters** (use `createMcpHandler` for the MCP transport, not `McpAgent`/DOs; the v1.2 edge-search DO is a separate, deliberate adapter — [ADR-0009](adr/0009-ephemeral-materialization.md)). The isomorphic-git mobile benchmark is a gating spike before any device-git-sync work. ([ADR-0028](adr/0028-dependency-and-risk-register.md))
- **Closed kernel, open edges.** The kernel is small and conformance-guarded; everything that varies (backends, drivers, transports, triggers, importers, connectors, model providers) is a typed extension point with a uniform contract (provenance, no-envelope-mutation, optional, web-standard). ([ADR-0031](adr/0031-extension-architecture.md))
- **Hosted inference is opt-in, no-train (contractually verified), retention bounded by the upstream provider's DPA, output-observable;** C0/BYO-model is the zero-operator-read floor. The user-facing claim softens until either a Cloudflare rider lands narrowing the "improve the Services" carve-out, or the v1.2 adapter switches to a provider with explicit zero retention ([ADR-0037](adr/0037-threat-model.md)). For the **naive no-agent user it is the *only* enrichment path** (MCP relocates but doesn't remove the model question — [ADR-0002](adr/0002-three-tier-capture.md)) — the **completeness lever** that makes the app payable standalone, so it is load-bearing for that tier, not just convenience, while staying behind the clean Tier-2 seam for C0/self-host. ([ADR-0027](adr/0027-longevity-and-revenue.md)/[ADR-0002](adr/0002-three-tier-capture.md)/[ADR-0001](adr/0001-observable-files.md))

## Canonical vocabulary

`capture · source · note · thread · tier · reader · agent · workspace`. One canonical name per concept. **No theming** (no nautical/archive metaphors in code or docs; no Maya glyphs or "sacred well" mysticism; no fantasy/gaming cues. Water-feel in voice and palette, never as overt naming in code).

Definitions are derived from the ADRs:

- **capture** — the act/event of submitting input that becomes a note; pushed to the lowest tier ([ADR-0002](adr/0002-three-tier-capture.md)).
- **source** — the raw-as-captured node (verbatim original, `type: context`); conditional, excluded from browse ([ADR-0005](adr/0005-data-model-note-and-source.md)).
- **note** — the system-of-record record in `notes/`; body may be model-phrased ([ADR-0005](adr/0005-data-model-note-and-source.md)).
- **thread** — the one authored lineage edge grouping related captures/notes; a PROV Activity ([ADR-0006](adr/0006-lineage.md)).
- **tier** — the capture tier (0 CLI-direct · 1 client-enriched · 2 edge-auto-classify) = the privacy/trust gradient ([ADR-0002](adr/0002-three-tier-capture.md)).
- **reader** — a read surface over the corpus: the mobile app, Obsidian, GitHub web, grep, the CLI ([ADR-0010](adr/0010-reader-app.md)).
- **agent** — the AI (e.g. Claude) that enriches captures over the MCP tool surface ([ADR-0002](adr/0002-three-tier-capture.md)/[ADR-0021](adr/0021-tool-and-sync-contract.md)).
- **workspace** — one notes repo = one workspace; one repo per workspace ([ADR-0003](adr/0003-substrate-and-layout.md)).

## Out of scope for v1

If a task drifts into these, **stop and flag** rather than gold-plating ([ADR-0020](adr/0020-mvp-scope.md)).

- On-*device* enrichment/embedding models
- **History rewrite** (force-push protection; the five-op correction surface — capture / append / edit / undo / delete — **is** in v1 at any age, [ADR-0026](adr/0026-operation-vocabulary.md) rev 14)
- **Semantic / vector search** (lexical edge search is IN at v1.2)
- C0 direct git sync from the app (device git-sync is the post-MVP ownership upgrade)
- Format importers + corroboration connectors ([ADR-0029](adr/0029-ingestion-and-corroboration.md))
- Rich/custom aggregations ([ADR-0008](adr/0008-search.md))

**Now IN v1, sequenced:** managed C1 custody + billing at v1.1; guardrailed Tier-2 hosted inference + lexical edge search at v1.2 ([ADR-0017](adr/0017-custody-tiers-auth-distribution.md)/[ADR-0027](adr/0027-longevity-and-revenue.md)/[ADR-0009](adr/0009-ephemeral-materialization.md)).

## Trust boundary — what the operator sees, and the behavioral-privacy floor

Note **content** (body / title / tags / source-raw / frontmatter) is never persisted operator-side at any tier. That's the load-bearing trust claim and it is structural, not promissory ([ADR-0037](adr/0037-threat-model.md)).

**Behavior is a different axis.** Logs, traces, and metrics necessarily show *who did what, when* — workspace identity, op type, latency, status — even with content excluded. A motivated attacker who breached the operator's logs could build a per-user op-frequency profile. Zonot mitigates this and is honest about it:

- **Workspace names are hashed** in Sentry tags and Analytics Engine indexes; raw names land only in dev `wrangler tail`.
- **Trace ids are per-request** with no cross-request correlation surfaced operator-side.
- **Logpush retention defaults to 7 days.**
- **"Don't read your own logs" operator hygiene** — logs exist to debug, not to browse for behavioral signal. The maker as operator binds to the same rule.

**If operator-visible behavior is part of your threat model, self-host (C0).** `zonot serve` is the CLI's local Worker mirror; no operator behavior is visible at C0. The trust claim Zonot makes is *about content*; the trust claim you can verify *yourself* is *about everything*, by running it on your own machine.

## Provenance

Zonot's name is adapted from the Yucatec Maya `dzonot` / `ts'ono'ot` — the root from which Spanish "cenote" derives. The naming evokes a small, calm opening above a deep, clear, connected system. We use the imagery, not the iconography.
