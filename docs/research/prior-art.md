# Croft — Prior-Art & Research Log

> Hand-authored evidence log (**not** generated; lives outside the `docs/adr` + `philosophy` +
> `architecture` generated set). These are the *sources* behind [`croft-seed.md`](../../croft-seed.md)
> rev 11–14 — the research that informed the ADRs, captured in-repo so the *why* is observable, not
> trapped in a chat transcript. Findings are mid-2026; treat post-cutoff specifics (e.g. star counts,
> dates) as "verify the live numbers." This is the manual dogfood of the ethos: capture raw context
> with provenance (ADR-0001/0007).

## 1. Competitive landscape (→ ADR-0025 / 0029)

- **Closest competitor — GBrain** (`garrytan/gbrain`, ~22k stars, MIT): Markdown-in-git, but
  **Postgres = source of truth, Markdown = projection**; typed edges/graph live only in the DB.
  Ships CLI + MCP + a self-hosted `/admin` console; **no reader/web UI, no mobile read app, no hosted
  version**. → Croft *inverts* this (files = truth) and fills the reader/mobile/hosted gap.
- **Adjacent agent→repo:** Basic Memory (MCP notes; S3/Neon cloud, not your git), nanobrain
  (raw→wiki in your repo, Claude-Code-hook-driven), `panosAthDBX/mcp-github-memory-server`,
  `markdown-vault-mcp`. Karpathy's "LLM wiki" gist legitimized the category.
- **PKM/editors storing plain MD in your git:** Foam, Dendron (dormant), Quartz (publish-only),
  Obsidian+Git plugin — none do capture-time agent enrichment. Logseq is moving to a proprietary
  DB+cloud; Anytype / Obsidian-Sync are encryption-as-trust (the foil Croft defines against).
- **Mobile git-backed apps:** GitJournal (dart-git), GitSync.md (libgit2), GitSync (Rust),
  Obsidian-git (isomorphic-git, "unstable on mobile"). **No one ships an FTS reader on
  RN+isomorphic-git** — Croft's whitespace.
- **Capture / read-later** (Drafts, Reflect, mymind, Readwise, Matter, Tana): all vendor-cloud; MD
  only as one-way export. None store in your own repo as source of truth.
- Sources: github.com/garrytan/gbrain · github.com/basicmachines-co/basic-memory · nanobrain.app ·
  github.com/GitJournal/GitJournal · github.com/Vinzent03/obsidian-git

## 2. Standards conformance (→ ADR-0005 / 0007 / 0021 / 0022)

- **Idempotency-Key is an expired IETF *draft*, not a standard** (`draft-ietf-httpapi-idempotency-key-header`)
  — cite as Stripe convention + draft.
- **MCP: pin spec `2025-11-25`** (tool shape stable; `outputSchema`/`structuredContent`/`isError` current).
- **Dublin Core:** `dc:source` = *derived-from*; map only true derivations; prefer
  `dcterms:isPartOf`/`references` over generic `relation`.
- **Obsidian properties:** `tags`/`aliases`/`cssclasses` reserved; **list-valued since 1.9**; native
  Date type is offset-free (UTC-`Z` renders as Text).
- **W3C PROV:** `wasDerivedFrom` / `wasAttributedTo` / `wasGeneratedBy` used correctly; keep `thread`
  an Activity.
- **RFC 9457:** `application/problem+json`; custom `retryable` is a legal extension; pair with `Retry-After`.
- **Git trailers:** `Key: value`, no collision with `Signed-off-by` / `Co-authored-by`.
- Sources: modelcontextprotocol.io/specification/2025-11-25 · rfc-editor.org/rfc/rfc9457 ·
  datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header · w3.org/TR/prov-o ·
  obsidian.md/help/properties

## 3. Local-first / sync model (→ ADR-0010 / 0026 / 0028)

- **git-as-sync is the right call** for Croft's create-mostly, single-user, no-realtime workload:
  it satisfies 6/7 Ink & Switch local-first ideals; the one it misses (realtime collaboration) is
  scoped out. CRDTs solve concurrent same-object editing — a problem Croft *designs away* (creates +
  recency-scoped correction).
- CRDT state is an opaque, growing blob → it would *invert* the ownership/longevity thesis.
  Practitioner consensus (Butler/Jamsocket, Weidner, Ably, the Cinapse postmortem): single-writer /
  server-ordered workloads don't need a CRDT.
- **The trust-breaking bug across every git-backed notes app: silent non-fast-forward overwrite.**
  → the divergence guard (ADR-0010): hard-stop, fetch→merge→re-push, conflict-copy-as-create, keep
  app-state out of the tree, ULID ordering, secure on-device creds.
- Sources: inkandswitch.com/essay/local-first · powersync.com/blog/why-cinapse-moved-away-from-crdts-for-sync ·
  jamsocket.com/blog/you-might-not-need-a-crdt

## 4. Git-on-mobile / isomorphic-git (→ ADR-0010 / 0018 #3 / 0028)

- isomorphic-git is actively maintained (2026) and runs on RN; **no maintained native-git RN module
  exists** — native is a *build* (gitoxide/libgit2 via uniffi/Nitro), not a port.
- Documented traps: packfile re-parse (status-in-a-loop → use `statusMatrix` + shared `cache`);
  **packfile bloat in the fetch→merge→re-push loop (#2017)**; clone hangs on large repos. The perf
  cliff is about history *size*, not file count → shallow `depth:1` + `notes/YYYY/MM/` stays clear.
- → v1 mobile rides the edge (risk off the critical path); the benchmark gates the post-MVP
  device-git path.
- Sources: isomorphic-git.org/docs/en/cache · github.com/isomorphic-git/isomorphic-git/issues/2017 ·
  github.com/jhugman/uniffi-bindgen-react-native

## 5. Threat proximity (→ ADR-0025)

- **Obsidian — complement, low threat.** No AI/agent/MCP on its public roadmap (Bases / Publish /
  Canvas / multiplayer); AI is community plugins; it trademark-enforced the `mcp-obsidian` rename.
  Watch the Web Clipper "Interpreter" (LLM extraction on capture).
- **Claude / vendor memory — mostly complement.** Shipped and broadly on, but **vendor-custody,
  opaque, weakly portable**; it erodes casual *recall*, not owned/portable/cross-tool *capture*.
  Claude Code's own memory (`CLAUDE.md`, `~/.claude/.../memory`) shows the category converging on
  "memory as owned files" → validates the thesis; watch a vendor shipping repo-backed memory with the
  ownership framing.
- Sources: obsidian.md/roadmap · claude.com/blog/memory · code.claude.com/docs/en/memory

## 6. Build-vs-port (→ ADR-0022 / ROADMAP)

- **Port:** `@modelcontextprotocol/sdk` + Cloudflare `createMcpHandler` (stateless, **no Durable
  Object**); `yaml` (eemeli, *not* `gray-matter`); `bun:sqlite` / `op-sqlite` FTS5; Obsidian +
  obsidian-git + Dataview/Datacore + Omnisearch for the **entire desktop surface**.
- **Build (the only genuine build):** the convention/conformance envelope, the shared FTS+facet
  layer, the version-aware write-client interface.
- Sources: github.com/modelcontextprotocol/typescript-sdk ·
  developers.cloudflare.com/agents/model-context-protocol/mcp-handler-api · npmjs.com/package/yaml ·
  github.com/OP-Engineering/op-sqlite
