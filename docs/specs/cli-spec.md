# CLI spec — command vocabulary, output, config, importer, MCP/serve modes

> **Companion to [ADR-0036](../adr/0036-cli-surface.md).** This document is the
> implementation contract for `apps/cli` (Phase 2). Hand-authored.
> When an ADR and this spec disagree, the ADR wins. ADR-0036 carries the load-bearing
> commitments; this doc carries the operational detail an agent or reviewer needs.

## 0. Scope

What this spec pins:

1. The full **command vocabulary** with arguments, flags, and behavior.
2. The **output discipline** — TTY detection, NDJSON, color, paging, exit codes.
3. The **config layout** — XDG paths, secret storage, mirror location, `ZONOT_HOME`.
4. The **backend split** — clone-holder default vs. `--worker=URL` thin-client mode.
5. The **`zonot mcp --stdio`** transport for the BYO-agent desktop dev.
6. The **`zonot serve`** transport — local HTTP Worker mirror for C0.
7. The **`zonot import`** behavior — discovery, frontmatter synthesis, provenance, conflict.
8. The **error discipline** — `ZonotProblem` mapping, trace ids, crash dump.

What this spec deliberately does NOT cover:

- The CLI's distribution pipeline (npm + Bun single binary + Homebrew — ADR-0023 has it).
- The `WriteClient` interface and `SearchEngine` (live in `packages/core` per core-spec).
- The bash/zsh/fish shell completion script content (mechanical; `zonot completion <shell>`).
- v1.1+ enhancements (Sentry on CLI, multi-account, completion of `import --from=` presets).

## 1. Command vocabulary

### 1.1 Top-level usage

```
zonot <command> [args] [flags]
zonot --help
zonot --version
zonot <command> --help

Global flags (apply to all commands):
  --workspace=NAME       Workspace (default: from config or single workspace)
  --json                 Emit NDJSON to stdout
  --quiet, -q            Suppress non-error output
  --verbose, -v          Verbose logging to stderr
  --no-color             Disable color (also: NO_COLOR env)
  --no-pager             Disable pager
  --worker=URL           Override config: use Worker for this invocation
  --local                Override config: use local clone-holder backend
  --help, -h
```

### 1.2 Commands

| Command | Behavior |
|---------|----------|
| `zonot init [--workspace=NAME] [--repo=URL]` | Scaffold `notes/`+`sources/`, write `zonot.json` in the repo, set up local config (`~/.config/zonot/`), prompt for credentials. If `--repo` given, clone it locally (clone-holder mode); if `--worker=URL` given, configure as a thin client. |
| `zonot capture [BODY] [--title=…] [--tags=…] [--thread=…] [--type=…] [--idempotency-key=…]` | Tier-0 capture. BODY from positional arg, piped stdin, or `$EDITOR` (interactive + no body). Inline `#tag`/`@thread`/`!type` parsing matches the mobile parser. |
| `zonot append <id> [BLOCK]` | Append timeline entry. BLOCK from arg, stdin, or `$EDITOR`. |
| `zonot correct <id> [BODY]` | Replace compiled body; timeline preserved. SHA-conditional. |
| `zonot undo <capture-id>` | Undo a capture by its capture id. |
| `zonot delete <id> [--reason=…]` | Delete note + sources. |
| `zonot read <id> [--raw] [--json]` | Render note. `--raw` shows file bytes; `--json` emits a `NoteRecord`. |
| `zonot list [--since=ISO] [--limit=N] [--group=tag\|type\|thread\|day]` | Recent or grouped listing. |
| `zonot search QUERY [--filter…] [--snippet] [--json]` | FTS5 lexical search over the local mirror. |
| `zonot tags [--prefix=…]` | List tags with counts. |
| `zonot workspaces` | List configured workspaces. |
| `zonot import <path> [--dry-run] [--from=obsidian\|gbrain\|markdown]` | Bulk importer (§7). |
| `zonot mcp [--stdio]` | Launch local stdio MCP server (§5). |
| `zonot serve [--port=N] [--bind=…]` | Launch local HTTP server (§6). |
| `zonot sync [--push] [--pull]` | Manual mirror sync (debugging). |
| `zonot status` | Workspace, outbox depth, sync state, last-error. |
| `zonot doctor` | Diagnostics — env, config, perms, repo reachability, FTS schema version. |
| `zonot logs [--tail] [--since=ISO] [--filter=…]` | Tail or query the local JSONL log. |
| `zonot completion <bash\|zsh\|fish>` | Emit shell completion script. |

### 1.3 Examples

```bash
# Quick capture
$ zonot capture "Quick note about launch #design @zonot"

# Pipe a long body
$ cat draft.md | zonot capture --title="Q3 plan"

# Open $EDITOR
$ zonot capture --title="Long note"

# Read as JSON
$ zonot read 01HZZZ… --json | jq '.frontmatter.tags'

# Grouped browse
$ zonot list --group=day --since=2026-06-01

# Search with snippets
$ zonot search "launch" --snippet --limit=10

# Bulk import an Obsidian vault
$ zonot import ~/obsidian/vault --from=obsidian --dry-run
$ zonot import ~/obsidian/vault --from=obsidian

# BYO-agent (desktop dev)
$ zonot mcp --stdio    # claude-code talks to this

# C0 self-hosted mobile backend
$ zonot serve --port=8787    # mobile app points at http://localhost:8787/<workspace>
```

## 2. Output discipline

### 2.1 TTY detection

```ts
const isTty = process.stdout.isTTY;
const wantJson = args['--json'] || !isTty;
```

- **`isTty` true and no `--json`:** human-rendered output — colored, table-formatted, snippets
  highlighted.
- **`isTty` false (piped) OR `--json`:** NDJSON to stdout, one record per line.
- **`stderr` always plain text.** Errors include the trace id. The same convention runs whether
  invoked from a terminal or scripted.

### 2.2 NDJSON shapes

`zonot read --json`:

```json
{"id":"01HZZ…","path":"notes/2026/06/01HZZ…-quick-note.md","frontmatter":{"id":"01HZZ…","v":1,"created":"2026-06-14T14:32:00Z","tags":["design"],"type":"note"},"body_compiled":"...","body_timeline":"...","sha":"abc123"}
```

`zonot list --json` / `zonot search --json`:

```json
{"id":"01HZZ…","title":"Quick note","tags":["design"],"created":"2026-06-14T14:32:00Z","snippet":"...launch <mark>preparation</mark>..."}
```

`zonot tags --json`:

```json
{"tag":"design","count":42}
{"tag":"todo","count":17}
```

One record per line; each line is independently parseable. Errors bypass NDJSON — they go to
stderr as text + a non-zero exit code.

### 2.3 Color discipline

- Use Restyle-style semantic role names internally (`accent`, `muted`, `danger`) mapping to
  ANSI palette via a small mapper (the same semantic vocab as the mobile spec; no nautical
  names).
- `NO_COLOR=1` or `--no-color` disables color (standard convention).
- Default color use: tag chips in `accent.solid`, snippet highlights in `accent.muted`,
  timestamps in `text.muted`, error text in `status.danger`.

### 2.4 Pager

- Engage `$PAGER` (default: `less -R`) automatically when output exceeds 1 screen for `list` /
  `search` / `logs` / `read`.
- Disable: `--no-pager` or `ZONOT_PAGER=cat`.

### 2.5 Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | User error (validation, not-found, conflict) |
| 2 | Upstream error (Worker down, GitHub down) |
| 3 | Config error (missing creds, malformed config) |
| 4 | Interrupted (SIGINT) |
| 10+ | Reserved for unrecoverable / internal |

## 3. Config layout

### 3.1 Paths (XDG-aware)

```
~/.config/zonot/
├── config.json          Workspace map; default workspace; backend resolution
└── credentials          chmod 600; PATs / OAuth tokens

~/.local/share/zonot/
└── <workspace>/
    ├── mirror/          isomorphic-git clone (clone-holder mode)
    ├── zonot.sqlite     local FTS + outbox + idempotency cache
    └── log/             JSONL logs (rotated, 2 MB cap; Fathom-lifted logger)

~/.cache/zonot/
└── <workspace>/         disposable caches (FTS rebuild scratch, etc.)
```

Override the entire tree with `ZONOT_HOME=/some/path`.

### 3.2 Windows mapping

```
%APPDATA%\zonot\          ~/.config/zonot/
%LOCALAPPDATA%\zonot\     ~/.local/share/zonot/
%LOCALAPPDATA%\zonot-cache\ ~/.cache/zonot/
```

Resolved via a standard XDG-on-Windows lib (look for `env-paths` or similar).

### 3.3 `config.json` shape

```json
{
  "default_workspace": "personal",
  "workspaces": {
    "personal": {
      "backend": "local",
      "repo": "git@github.com:cdhorne/zonot-notes.git",
      "mirror_path": "~/.local/share/zonot/personal/mirror"
    },
    "work": {
      "backend": "worker",
      "worker_url": "https://zonot.work.example.com/abc123",
      "workspace_name": "work"
    }
  }
}
```

### 3.4 `credentials` shape

Per-workspace token storage. JSON map keyed by workspace; chmod 600. Never logged. Per-row
shape varies by backend (PAT for local-backend git operations; OAuth tokens for worker-backend).

## 4. Backend split

### 4.1 Clone-holder default

`zonot init` (with no `--worker`) clones the repo locally and the `WriteClient` resolves to
`IsomorphicGitBackend` (core-spec §3). All reads/writes go through the local clone; push
happens on a configurable cadence (default: after every write, batched in 1s windows).

### 4.2 `--worker=URL` opt-in

`zonot init --worker=URL` configures the workspace as a thin client. `WriteClient` resolves to
`GitHubRestBackend` over HTTP to the Worker. No local clone; the local FTS rebuilds from a
periodic pull or on-demand fetch.

### 4.3 Switching backends

`zonot workspaces set-backend <ws> <local|worker>` (one-time migration). Switching `local` →
`worker`: clears local mirror after confirm. Switching `worker` → `local`: clones the repo.

## 5. `zonot mcp --stdio`

### 5.1 Transport

Spawns a stdio MCP server compatible with the MCP spec revision (per ADR-0021/0022, `2025-11-25`
or current). Exposes the same tools as the Worker (capture, append, correct, undo, delete,
read, list, search, tags, workspaces, list_recent, list — the ADR-0021 surface).

Reuses the core handlers (ADR-0022 "one handler set, two transports"; this is the third).
Tools register with their Zod schemas; identical input/output shapes to the Worker.

### 5.2 Use case

Desktop dev runs `zonot mcp --stdio` as a Claude Code MCP server (configured in `~/.claude/`).
Claude captures via the BYO-agent flow → tool invocation → core handlers → isomorphic-git
backend → local clone + scheduled push. The dev's BYO-agent path lives entirely on the desktop;
no network round-trip for capture.

### 5.3 No daemon mode

`zonot mcp --stdio` is foreground; one process per agent host. No `--daemon` mode in v1.0.

## 6. `zonot serve`

### 6.1 Transport

Launches a local HTTP server (default port 8787; override with `--port`) implementing the same
endpoints as the Worker, against the local clone-holder backend.

### 6.2 Use case

C0 self-hosted users who want the mobile app's experience without deploying a Cloudflare
Worker. They run `zonot serve` on a machine on their LAN; the mobile app's onboarding screen
points at `http://10.0.0.5:8787/<workspace>` (or `https://...` if reverse-proxied with a cert).

### 6.3 Error discipline mirrors Worker

Same `ZonotProblem` taxonomy (ADR-0035 §1.1), same trace id header (`zonot-trace-id`), same RFC
9457 problem-body shape. The mobile app cannot tell a `zonot serve` from a real Worker except
by URL.

### 6.4 No TLS in v1.0

`zonot serve` is plain HTTP. Users wanting TLS run it behind a reverse proxy (Caddy / nginx /
Tailscale serve). v1.1+ may add `--tls` with auto-cert via Caddy embedded — defer.

## 7. `zonot import`

### 7.1 Input discovery

`zonot import <path>` walks `<path>` recursively, finding `.md` files. Skips: `.git/`,
`node_modules/`, hidden directories starting with `.`, files matching `.zonot-ignore` patterns
in any ancestor directory.

### 7.2 Frontmatter synthesis

For each file:

1. Parse existing YAML frontmatter (if any).
2. Synthesize missing fields:
   - `id`: ULID derived deterministically from `(relpath, ctime)` so reruns don't duplicate.
   - `v`: `1`.
   - `created`: file ctime, OR existing frontmatter `date` / `created`, OR file mtime.
   - `tags`: union of frontmatter `tags` (list or comma-string) + inline `#tag` matches in body
     (per the mobile parser §2.2).
   - `type`: `note` (default); preserved if present.
3. Run tag-norm (lowercase / trim / hyphenate / dedupe per core-spec §1.5).
4. Render canonical frontmatter (key order per core-spec §1.1).

### 7.3 Provenance

Every import commit carries:

```
Source: import:zonot@<version>
Capture-Id: <ULID for this import event>
Imported-From: <relpath in the import root>
```

The `sources/` node is written per ADR-0034 rev 6 byte-equality rule — typically the imported
file IS distinct from the rendered note (frontmatter reshape, tag normalization), so a source
node materializes preserving the verbatim original.

### 7.4 Batching

Commits batched in groups of 50 notes per commit (configurable: `--batch=N`). Each batch is
atomic via the Git Data tree API (or sequential Contents calls for the local backend).

### 7.5 Conflict handling

If a target note path already exists with a different content hash, append `-2`, `-3`, ...
suffix to the slug before the `.md`. Never overwrite. Report each conflict in the dry-run plan
+ final summary.

### 7.6 Dry-run

`--dry-run` prints:

```
plan:
  /vault/2024/inbox.md      → notes/2024/06/01HZZ…-inbox.md            (new)
  /vault/2024/foo.md        → notes/2024/06/01HZZ…-foo.md              (new)
  /vault/old/typo.md        → notes/2023/11/01HXX…-typo-2.md           (CONFLICT: -2 suffix)

summary: 1247 notes planned, 1245 new, 2 conflicts, 0 skipped
batches: 25 commits planned
```

## 8. Error discipline

### 8.1 Internal model

Same `ZonotProblem` shape as the Worker (ADR-0035 §1.1). Errors thrown from `packages/core`
propagate as typed errors; the CLI's IO boundary serializes them.

### 8.2 Rendering

```
$ zonot capture "test"
error: sha-conflict
  the note has changed since you last read it (expected abc123, got def456)
  trace_id: 01HZZ…
  try: zonot read <id> to see the current version

$ exit code 1
```

### 8.3 `--json` errors

Errors bypass NDJSON on stdout. They always go to stderr as plain text. Exit code carries the
class. Rationale: piped consumers can read NDJSON unconditionally from stdout; errors are an
out-of-band signal.

### 8.4 Crash dumps

Uncaught exceptions write a JSON dump to `$ZONOT_HOME/crashes/<trace_id>.json` containing:
stack trace, environment, command line (with secrets redacted), node/Bun version, OS info. **No
note body / tag / title content** — same content-free rule as the Worker.

`zonot doctor` lists recent crashes with paste-able trace ids. The user attaches the dump when
filing an issue.

## 9. Performance budgets

Per-operation latency / throughput / memory budgets — cold start, capture, search, import
throughput, idle memory — live in [`perf-budgets.md`](perf-budgets.md) §4. The CI bench
discipline (mitata + regression detection) applies per-PR.

## 10. Open items

- **Sentry on the CLI** — deferred; revisit at v1.1.
- **`--from=obsidian|gbrain|markdown` preset details** — v1.0 ships `markdown` (the generic
  case) + auto-detect of Obsidian (frontmatter `tags` style + vault structure). The `gbrain`
  preset waits until there's an actual gbrain export to test against.
- **Multi-account / multi-workspace concurrent operations** — v1.0 ships one workspace at a
  time per process (use `--workspace=NAME` to switch); concurrent multi-workspace deferred.
- **TLS on `zonot serve`** — defer to v1.1 with embedded Caddy or manual reverse-proxy
  documentation.
