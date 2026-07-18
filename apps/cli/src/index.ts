#!/usr/bin/env node
// @zonot/cli entry point (cli-spec §1, §8). Parse args, dispatch, and map any
// thrown error to a stderr message + an exit code that carries the class. A
// per-invocation trace id ties an error to the (future) local JSONL log.
//
// Runs on Node or Bun. Search uses SQLite (node:sqlite / bun:sqlite); on Node 22
// node:sqlite needs --experimental-sqlite, so a search-family command transparently
// re-execs with the flag (removed when node:sqlite is stable / on Bun).

import { createRequire } from 'node:module';
import { generateUlid } from '@zonot/core';
import { type ParsedArgs, parseArgs } from './args.ts';
import {
  cmdAppend,
  cmdCapture,
  cmdCorrect,
  cmdDelete,
  cmdImport,
  cmdInit,
  cmdList,
  cmdRead,
  cmdSearch,
  cmdStatus,
  cmdSync,
  cmdTags,
  cmdUndo,
  cmdWorkspaces,
} from './commands.ts';
import { EXIT, renderError } from './output.ts';
import { VERSION } from './version.ts';

const HELP = `zonot — calm capture, deep notes, plain Markdown in your own repo

usage: zonot <command> [args] [flags]

commands:
  init [--workspace=NAME] [--repo=URL]   scaffold a workspace (local clone-holder)
  capture [BODY] [--title=…] [--tags=…]  create a note (inline #tag @thread !type)
  append <id> [BLOCK]                    add a dated timeline entry
  correct <id> [BODY]                    replace the compiled body (timeline kept)
  undo <capture-id>                      remove a just-captured note
  delete <id>                            delete a note + its source
  read <id> [--raw] [--json]             render a note
  search QUERY [--limit=N]               FTS5 search over the local index
  list [--group=tag|type|day] [--since=] recent or grouped listing
  tags [--prefix=…]                      tag counts
  import <path> [--dry-run] [--batch=N]  bulk-import a folder of Markdown
  sync                                   push local captures to the repo; pull what's new
  status                                 workspace + mirror state
  workspaces                             list configured workspaces

global flags: --workspace=NAME  --json  --quiet/-q  --no-color  --help/-h  --version
`;

type Handler = (args: ParsedArgs) => number | Promise<number>;

const COMMANDS: Record<string, Handler> = {
  init: cmdInit,
  capture: cmdCapture,
  append: cmdAppend,
  correct: cmdCorrect,
  undo: cmdUndo,
  delete: cmdDelete,
  read: cmdRead,
  search: cmdSearch,
  list: cmdList,
  tags: cmdTags,
  import: cmdImport,
  sync: cmdSync,
  status: cmdStatus,
  workspaces: cmdWorkspaces,
};

// Commands whose landing is sequenced later in Phase 2.
const PENDING: Record<string, string> = {
  mcp: 'a later Phase 2 unit',
  serve: 'a later Phase 2 unit',
  logs: 'a later Phase 2 unit',
  doctor: 'a later Phase 2 unit',
  completion: 'a later Phase 2 unit',
};

const SQLITE_COMMANDS = new Set(['search', 'list', 'tags']);

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.flags.version === true || args.command === 'version') {
    process.stdout.write(`zonot ${VERSION}\n`);
    return EXIT.ok;
  }
  if (!args.command || args.flags.help === true || args.command === 'help') {
    process.stdout.write(HELP);
    return EXIT.ok;
  }

  // node:sqlite on Node 22 is gated behind a flag; re-exec with it so search
  // "just works" without the user knowing. No-op on Bun / stable node:sqlite.
  if (args.command && SQLITE_COMMANDS.has(args.command) && needsSqliteReexec()) {
    return reexecWithSqlite();
  }

  const handler = COMMANDS[args.command];
  if (handler) return handler(args);

  if (PENDING[args.command]) {
    process.stderr.write(
      `zonot ${args.command}: not yet implemented — lands in ${PENDING[args.command]}\n`,
    );
    return EXIT.user;
  }

  process.stderr.write(`zonot: unknown command "${args.command}"\n\n${HELP}`);
  return EXIT.user;
}

/** True only on Node where node:sqlite isn't loadable yet (needs the flag). */
function needsSqliteReexec(): boolean {
  if (process.versions.bun) return false; // Bun has bun:sqlite
  if (process.env.ZONOT_SQLITE_REEXEC) return false; // already re-execed
  try {
    createRequire(import.meta.url)('node:sqlite');
    return false; // stable (Node 24+) — no flag needed
  } catch {
    return true;
  }
}

async function reexecWithSqlite(): Promise<number> {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const r = spawnSync(
    process.execPath,
    [
      '--experimental-sqlite',
      '--no-warnings',
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2),
    ],
    { stdio: 'inherit', env: { ...process.env, ZONOT_SQLITE_REEXEC: '1' } },
  );
  return r.status ?? EXIT.internal;
}

const traceId = generateUlid();
// Set exitCode and let the event loop drain — calling process.exit() here would
// truncate buffered stdout when output is piped (e.g. `zonot list | jq`).
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    process.exitCode = renderError(parseArgs(process.argv.slice(2)), err, traceId);
  });
