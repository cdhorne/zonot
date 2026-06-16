#!/bin/bash
# SessionStart hook — ensure the monorepo is dependency-ready in Claude Code on
# the web. Fresh web containers clone the repo without node_modules; without this
# `pnpm check` / `pnpm typecheck` / `pnpm test` would fail on a cold start.
# Runs synchronously so dependencies are present before the agent loop begins.
set -euo pipefail

# Only run in the remote (web) environment; local sessions manage their own deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# corepack ships with Node; activate the pinned pnpm from package.json#packageManager.
corepack enable >/dev/null 2>&1 || true

# Lockfile is committed and CI uses --frozen-lockfile; match it so a session can
# never silently drift from CI. Idempotent: a no-op when already installed.
pnpm install --frozen-lockfile
