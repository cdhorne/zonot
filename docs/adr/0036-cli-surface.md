---
adr: 0036
title: CLI surface specification
status: Accepted (rev 1)
slug: cli-surface
tags: [cli, ux, scope]
---

# ADR-0036. CLI surface specification

## Context

ADR-0023 nailed CLI distribution and ADR-0024 placed it in the build order, but the command surface — vocabulary, output discipline, config layout, importer shape, MCP-mode and serve-mode — was implicit. The CLI is the maker's primary dogfood tool alongside the mobile app and the Tier-1 BYO-agent path for desktop devs. Companion: **[`docs/specs/cli-spec.md`](../specs/cli-spec.md)**.

## Decision

### Command vocabulary

`init`, `capture`, `append`, `correct`, `undo`, `delete`, `read`, `list`, `search`, `tags`, `workspaces`, `import`, `mcp`, `serve`, `sync`, `status`, `doctor`, `logs`. Write ops mirror the `WriteClient` interface 1:1 (ADR-0022); read ops mirror the tool contract (ADR-0021); the rest are power surfaces. **Body input for `capture`** comes from positional arg, stdin (piped), or `$EDITOR` (interactive + no positional body).

### Output discipline

**Human-by-default, machine-readable on opt-in.** TTY detection drives color + tables + snippet rendering. When `stdout` is piped OR `--json` is set, emit **NDJSON**. `stderr` is always plain text with the trace id echoed on errors. **Exit codes:** `0` success; `1` user error; `2` upstream (Worker / GitHub) down; `3` config error; `≥10` unrecoverable. `NO_COLOR` disables color; pager auto-engages for `list`/`search` output > 1 screen unless `--no-pager`.

### Config layout (XDG-aware)

`~/.config/zonot/config.json` (workspace map); `~/.config/zonot/credentials` (chmod 600); `~/.local/share/zonot/<ws>/` (per-workspace mirror clone); `~/.local/share/zonot/<ws>/zonot.sqlite` (local FTS + outbox); `~/.cache/zonot/<ws>/` (disposable). `ZONOT_HOME` overrides the whole tree. Windows maps to `%APPDATA%\zonot\` via XDG-on-Windows libs.

### Backend split

**Clone-holder by default** — `zonot init` clones the repo locally and the `WriteClient` resolves to the isomorphic-git backend. Idiomatic for the dev audience. **`--worker=URL` opt-in** (configured at `init`) — CLI becomes a thin client over the Worker, mirroring the mobile app's wire shape, for users who want managed C1 without a clone. Same `WriteClient` interface; backend resolved from config.

### `zonot mcp --stdio` ships v1.0

Launches a stdio MCP server exposing the same tools as the Worker against the CLI's local backend. The Tier-1 BYO-agent path for desktop devs (Claude Code / similar) — captures land via isomorphic-git into the user's clone; push happens on a configurable cadence. Reuses the core handlers (ADR-0022's "one handler set, two transports" — third being stdio).

### `zonot serve` ships v1.0

Launches a local HTTP server mirroring the Worker's endpoints, against the CLI's local backend. **Lowers C0 self-hosted deployment friction dramatically** — instead of deploying a Cloudflare Worker, a C0 user runs `zonot serve` and points their mobile app at `http://localhost:port/<workspace>`. The mobile app already speaks the Worker protocol; `zonot serve` IS the local Worker. Reuses the same handler set + Worker error discipline (ADR-0035).

### `zonot import` (minimal bulk importer, ADR-0029 v1 slice)

Source: a directory of markdown files (Obsidian vault, gbrain dump, generic `.md` corpus). Convention detection: YAML frontmatter parsed; missing fields synthesized (`id` = ULID derived from path + ctime; `created` from ctime or frontmatter `date`; `tags` from inline `#tag` + frontmatter `tags`). **Provenance:** every imported note gets an `Imported-From: <relpath>` commit trailer + a `sources/` node with the verbatim original (per ADR-0034 byte-equality rule). Mode: `--dry-run` shows the plan; without it, batches one commit per 50 notes. Conflict handling: target exists → append `-2`, `-3`; never overwrite.

### Error discipline mirrors the Worker

Local-backend errors produce the same `ZonotProblem` shape (ADR-0035), rendered as stderr text by default and JSON with `--json`. Trace ids locally generated when no Worker round-trip. **Sentry on the CLI deferred** — local crash dump to `$ZONOT_HOME/crashes/<trace_id>.json` for the user to paste; operator-side reporting is a future call.

## Consequences

Phase 2 (CLI) is scopable as discrete tasks: command parser + IO discipline, XDG config layer, clone-holder backend, MCP-stdio transport, HTTP-serve transport, importer. `zonot mcp` and `zonot serve` are not gold-plating — they unlock two distinct user segments without duplicating handler code. "One handler set, two transports" (ADR-0022) becomes "one handler set, four transports" (MCP-stdio / MCP-http via Worker / HTTP via Worker / HTTP via `zonot serve`); the multiplication is at the transport adapter only.

## Open

Shell completions (`zonot completion <shell>` — cheap, ship); the `import`'s `--from=obsidian|gbrain|markdown` flag (presets vs auto-detection — defer); Sentry policy for the CLI at v1.1+.
