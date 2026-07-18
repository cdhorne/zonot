// Command handlers (cli-spec §1.2). Each resolves its workspace + backend, calls
// the core WriteClient (writes) or the local FTS index (reads), and emits per the
// output discipline.

import { existsSync } from 'node:fs';
import { assembleNoteFile } from '@zonot/core';
import { WorkspaceNotInitializedError } from '@zonot/core/errors';
import type {
  ListGroupBy,
  NoteRecord,
  NoteSummary,
  TagSummary,
  WriteResult,
} from '@zonot/core/schema';
import type { ParsedArgs } from './args.ts';
import { flagBool, flagNum, flagStr } from './args.ts';
import { buildBackend, gitAuthor } from './backend.ts';
import { parseInline } from './capture-parse.ts';
import {
  ConfigError,
  defaultMirrorPath,
  loadConfig,
  paths,
  resolveWorkspace,
  saveConfig,
  type WorkspaceConfig,
} from './config.ts';
import { planImport, runImport } from './import.ts';
import { type Index, openIndex } from './index-store.ts';
import { EXIT, emit, emitLines, makeStyle, wantJson } from './output.ts';
import { cloneExistingRepo, localSyncState, syncWorkspace } from './sync.ts';

interface Ctx {
  name: string;
  ws: WorkspaceConfig;
  backend: ReturnType<typeof buildBackend>;
}

function resolve(args: ParsedArgs): Ctx {
  const { name, ws } = resolveWorkspace(loadConfig(), flagStr(args.flags, 'workspace'));
  return { name, ws, backend: buildBackend(name, ws) };
}

/** Body from the positional arg, else piped stdin. Undefined when interactive + empty. */
async function resolveBody(args: ParsedArgs, index: number): Promise<string | undefined> {
  const pos = args.positionals[index];
  if (pos !== undefined) return pos;
  if (!process.stdin.isTTY) return (await readStdin()).replace(/\n$/, '');
  return undefined;
}

/** Read all of stdin — portable across Node and Bun (both async-iterate it). */
async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Uint8Array);
  return Buffer.concat(chunks).toString('utf8');
}

function requireId(args: ParsedArgs, index: number, label = 'id'): string {
  const id = args.positionals[index];
  if (!id) throw new ConfigError(`missing ${label} argument`);
  return id;
}

// Recognized everywhere, so per-command allowlists below only list their own flags.
const GLOBAL_FLAGS = new Set([
  'workspace',
  'json',
  'quiet',
  'no-color',
  'verbose',
  'help',
  'version',
]);

/**
 * Reject a flag no handler reads or a positional no handler consumes. Without
 * this, `--title "some title"` (space form; this parser only supports
 * `--title=…`) silently becomes a boolean `title` flag plus a dropped
 * positional, with no error to explain why the title never landed.
 */
function assertKnownArgs(
  args: ParsedArgs,
  command: string,
  known: ReadonlySet<string>,
  maxPositionals: number,
): void {
  for (const key of Object.keys(args.flags)) {
    if (GLOBAL_FLAGS.has(key) || known.has(key)) continue;
    throw new ConfigError(`zonot ${command}: unknown flag --${key}`);
  }
  if (args.positionals.length > maxPositionals) {
    throw new ConfigError(
      `zonot ${command}: unexpected argument "${args.positionals[maxPositionals]}"`,
    );
  }
}

// --- init ------------------------------------------------------------------

export async function cmdInit(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'init', new Set(['repo', 'worker']), 0);
  const name = flagStr(args.flags, 'workspace') ?? 'personal';
  if (flagStr(args.flags, 'worker')) {
    throw new ConfigError('worker thin-client mode is not wired yet (Phase 2a is local-only)');
  }
  const config = loadConfig();
  const mirror_path = defaultMirrorPath(name);
  const repo = flagStr(args.flags, 'repo');
  const ws: WorkspaceConfig = { backend: 'local', mirror_path, ...(repo ? { repo } : {}) };

  // With an upstream that already has history, adopt it (clone) rather than
  // starting a divergent empty repo `sync` would refuse to merge. An empty
  // remote (or none) falls through to local init; the first `sync` pushes.
  let cloned = false;
  if (repo && !existsSync(`${mirror_path}/.git`)) {
    cloned = await cloneExistingRepo({ dir: mirror_path, repo });
  }

  // Idempotent: inits an empty repo when we didn't clone, and only writes any
  // still-missing scaffold (marker/dirs) when we did.
  const result = await buildBackend(name, ws).init({ workspace: name, conventionVersion: 1 });

  config.workspaces[name] = ws;
  config.default_workspace ??= name;
  saveConfig(config);

  const s = makeStyle(args);
  emit(args, { workspace: name, mirror_path, cloned, paths: result.paths }, () =>
    cloned
      ? `${s.accent('✓')} cloned ${s.bold(ws.repo ?? repo ?? '')} into workspace ${s.bold(name)} at ${mirror_path}`
      : `${s.accent('✓')} initialized workspace ${s.bold(name)} at ${mirror_path}${ws.repo ? `\n  ${s.muted(`(repo ${ws.repo} stored; \`zonot sync\` will push)`)}` : ''}`,
  );
  return EXIT.ok;
}

// --- capture ---------------------------------------------------------------

export async function cmdCapture(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'capture', new Set(['title', 'tags', 'thread', 'type']), 1);
  const ctx = resolve(args);
  const body = (await resolveBody(args, 0)) ?? '';
  const inline = parseInline(body);
  const flagTags = (flagStr(args.flags, 'tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const title = flagStr(args.flags, 'title');
  const type = flagStr(args.flags, 'type') ?? inline.type;
  const thread = flagStr(args.flags, 'thread') ?? inline.thread;
  const tags = [...inline.tags, ...flagTags];

  // Empty-body capture is allowed (core-spec §6) but only when there's some
  // facet to capture — a title or tags — so a bare `zonot capture` isn't a no-op.
  if (body.trim() === '' && !title && tags.length === 0) {
    throw new ConfigError('provide a body (argument or stdin) or at least --title / --tags');
  }

  const result = await ctx.backend.capture({
    workspace: ctx.name,
    output: { body, tags, ...(title ? { title } : {}), ...(type ? { type } : {}) },
    ...(thread ? { thread } : {}),
  });
  emitWrite(args, result, 'captured');
  return EXIT.ok;
}

// --- correction surface ----------------------------------------------------

export async function cmdAppend(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'append', new Set(), 2);
  const ctx = resolve(args);
  const id = requireId(args, 0);
  const block = await resolveBody(args, 1);
  if (!block) throw new ConfigError('provide a timeline block argument or pipe one on stdin');
  const head = await ctx.backend.head({ workspace: ctx.name, id });
  if (!head) throw notFound(id);
  emitWrite(
    args,
    await ctx.backend.append({ workspace: ctx.name, id, block, base_sha: head.sha }),
    'appended',
  );
  return EXIT.ok;
}

export async function cmdCorrect(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'correct', new Set(['title']), 2);
  const ctx = resolve(args);
  const id = requireId(args, 0);
  const body = await resolveBody(args, 1);
  if (body === undefined) throw new ConfigError('provide a body argument or pipe one on stdin');
  const head = await ctx.backend.head({ workspace: ctx.name, id });
  if (!head) throw notFound(id);
  const title = flagStr(args.flags, 'title');
  const result = await ctx.backend.correct({
    workspace: ctx.name,
    id,
    output: { body, ...(title ? { title } : {}) },
    base_sha: head.sha,
  });
  emitWrite(args, result, 'corrected');
  return EXIT.ok;
}

export async function cmdUndo(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'undo', new Set(), 1);
  const ctx = resolve(args);
  emitWrite(
    args,
    await ctx.backend.undo({ workspace: ctx.name, capture_id: requireId(args, 0, 'capture-id') }),
    'undone',
  );
  return EXIT.ok;
}

export async function cmdDelete(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'delete', new Set(), 1);
  const ctx = resolve(args);
  emitWrite(
    args,
    await ctx.backend.delete({ workspace: ctx.name, id: requireId(args, 0) }),
    'deleted',
  );
  return EXIT.ok;
}

// --- read ------------------------------------------------------------------

export async function cmdRead(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'read', new Set(['raw', 'include-source']), 1);
  const ctx = resolve(args);
  const note = await ctx.backend.readNote({
    workspace: ctx.name,
    id: requireId(args, 0),
    include_source: flagBool(args.flags, 'include-source'),
  });
  if (flagBool(args.flags, 'raw')) {
    // Full file bytes (cli-spec §2.1) — frontmatter block + body, not body alone.
    process.stdout.write(assembleNoteFile(note.frontmatter, note.raw_body));
    return EXIT.ok;
  }
  emit(args, note, () => renderNote(args, note));
  return EXIT.ok;
}

// --- search / list / tags (local FTS index) --------------------------------

async function withIndex<T>(
  args: ParsedArgs,
  fn: (index: Index, workspace: string) => T,
): Promise<T> {
  const { name, ws } = resolveWorkspace(loadConfig(), flagStr(args.flags, 'workspace'));
  if (!ws.mirror_path) throw new ConfigError(`workspace "${name}" has no mirror_path`);
  const index = await openIndex(name, ws.mirror_path, paths().dataDir);
  try {
    return fn(index, name);
  } finally {
    index.close();
  }
}

export async function cmdSearch(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'search', new Set(['limit']), 1);
  const q = args.positionals[0];
  if (!q) throw new ConfigError('missing search query');
  const page = await withIndex(args, (index, workspace) =>
    index.engine.search({ workspace, q, ...optLimit(args) }),
  );
  emitLines(args, page.results, (r) => renderSummary(args, r as NoteSummary));
  return EXIT.ok;
}

export async function cmdList(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'list', new Set(['group', 'since', 'limit']), 0);
  const group = flagStr(args.flags, 'group') as ListGroupBy | undefined;
  const since = flagStr(args.flags, 'since');
  await withIndex(args, (index, workspace) => {
    const s = makeStyle(args);
    if (group) {
      const page = index.engine.list({ workspace, group_by: group, ...optLimit(args) });
      emitLines(args, page.groups, (g) => {
        const bucket = g as { key: string; count: number };
        return `${s.accent(bucket.key)} ${s.muted(`(${bucket.count})`)}`;
      });
    } else {
      const recent = index.engine.listRecent({
        workspace,
        ...(since ? { since } : {}),
        ...optLimit(args),
      });
      emitLines(args, recent, (r) => renderSummary(args, r as NoteSummary));
    }
  });
  return EXIT.ok;
}

export async function cmdTags(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'tags', new Set(['prefix']), 0);
  const prefix = flagStr(args.flags, 'prefix');
  const tags = await withIndex(args, (index, workspace) =>
    index.engine.listTags({ workspace, ...(prefix ? { prefix } : {}) }),
  );
  const s = makeStyle(args);
  emitLines(args, tags, (t) => {
    const tag = t as TagSummary;
    return `${s.accent(`#${tag.tag}`)} ${s.muted(`(${tag.count})`)}`;
  });
  return EXIT.ok;
}

function optLimit(args: ParsedArgs): { limit?: number } {
  const limit = flagNum(args.flags, 'limit');
  return limit === undefined ? {} : { limit };
}

function renderSummary(args: ParsedArgs, r: NoteSummary): string {
  const s = makeStyle(args);
  const tags = r.tags.length ? `  ${r.tags.map((t) => s.accent(`#${t}`)).join(' ')}` : '';
  const snippet = r.snippet ? `\n  ${s.muted(r.snippet)}` : '';
  return `${s.bold(r.title || r.id)}  ${s.muted(r.path)}${tags}${snippet}`;
}

// --- import ----------------------------------------------------------------

export async function cmdImport(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'import', new Set(['from', 'dry-run', 'batch']), 1);
  const path = args.positionals[0];
  if (!path) throw new ConfigError('missing import path');
  const { name, ws } = resolveWorkspace(loadConfig(), flagStr(args.flags, 'workspace'));
  if (!ws.mirror_path) throw new ConfigError(`workspace "${name}" has no mirror_path`);
  if (!existsSync(`${ws.mirror_path}/.git`)) throw new WorkspaceNotInitializedError(ws.mirror_path);

  if (flagStr(args.flags, 'from')) {
    process.stderr.write(
      'zonot import: --from presets land in v1.1; importing as generic markdown\n',
    );
  }

  const plan = planImport(path, ws.mirror_path);
  const s = makeStyle(args);
  const count = (status: string) => plan.notes.filter((n) => n.status === status).length;

  if (flagBool(args.flags, 'dry-run')) {
    emitLines(
      args,
      plan.notes.map((n) => ({ from: n.relpath, to: n.notePath, status: n.status })),
      (r) => {
        const row = r as { from: string; to: string; status: string };
        return `  ${row.from} ${s.muted('→')} ${row.to} ${s.muted(`(${row.status})`)}`;
      },
    );
    process.stderr.write(
      `${s.muted(`plan: ${plan.notes.length} notes — ${count('new')} new, ${count('update')} update, ${count('unchanged')} unchanged`)}\n`,
    );
    return EXIT.ok;
  }

  const batch = flagNum(args.flags, 'batch') ?? 50;
  const result = await runImport(plan, ws.mirror_path, gitAuthor(), batch);
  emit(
    args,
    {
      written: result.written,
      unchanged: result.unchanged,
      commits: result.commits,
      new: count('new'),
      update: count('update'),
    },
    () =>
      `${s.accent('✓')} imported ${result.written} note${result.written === 1 ? '' : 's'} (${result.unchanged} unchanged) in ${result.commits} commit${result.commits === 1 ? '' : 's'}`,
  );
  return EXIT.ok;
}

// --- sync ------------------------------------------------------------------

export async function cmdSync(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'sync', new Set(), 0);
  const { name, ws } = resolveWorkspace(loadConfig(), flagStr(args.flags, 'workspace'));
  if (ws.backend !== 'local') {
    throw new ConfigError(`workspace "${name}" is not a local clone-holder — nothing to sync`);
  }
  if (!ws.mirror_path) throw new ConfigError(`workspace "${name}" has no mirror_path`);
  if (!existsSync(`${ws.mirror_path}/.git`)) throw new WorkspaceNotInitializedError(ws.mirror_path);
  if (!ws.repo) {
    throw new ConfigError(
      `workspace "${name}" has no upstream repo — re-run \`zonot init --repo=…\` ` +
        'or add a "repo" to the workspace in config.json',
    );
  }

  const result = await syncWorkspace({ dir: ws.mirror_path, repo: ws.repo, author: gitAuthor() });
  const s = makeStyle(args);
  emit(args, result, () =>
    result.up_to_date
      ? `${s.accent('✓')} already in sync with ${s.muted(result.remote)}`
      : `${s.accent('✓')} synced with ${s.muted(result.remote)}  ${s.bold(`↑${result.pushed}`)} ${s.bold(`↓${result.pulled}`)}`,
  );
  return EXIT.ok;
}

// --- introspection ---------------------------------------------------------

export async function cmdStatus(args: ParsedArgs): Promise<number> {
  assertKnownArgs(args, 'status', new Set(), 0);
  const { name, ws } = resolveWorkspace(loadConfig(), flagStr(args.flags, 'workspace'));
  const initialized = ws.mirror_path ? existsSync(`${ws.mirror_path}/.git`) : false;
  // Offline read: ahead/behind the last-fetched origin, no network/token.
  const sync =
    initialized && ws.mirror_path
      ? await localSyncState({ dir: ws.mirror_path, ...(ws.repo ? { repo: ws.repo } : {}) })
      : undefined;
  const s = makeStyle(args);
  emit(
    args,
    {
      workspace: name,
      backend: ws.backend,
      mirror_path: ws.mirror_path,
      initialized,
      repo: ws.repo ?? null,
      ...(sync ? { ahead: sync.ahead, behind: sync.behind, tracking: sync.tracking } : {}),
    },
    () => {
      const lines = [
        `${s.bold(name)}  ${s.muted(`(${ws.backend})`)}`,
        `  mirror: ${ws.mirror_path ?? '—'} ${initialized ? s.accent('✓') : s.danger('(not initialized)')}`,
      ];
      if (ws.repo) lines.push(`  repo: ${s.muted(ws.repo)}`);
      if (sync) {
        lines.push(
          sync.tracking
            ? `  sync: ${s.bold(`↑${sync.ahead}`)} unpushed  ${s.bold(`↓${sync.behind}`)} unpulled`
            : ws.repo
              ? `  sync: ${s.muted('not yet synced — run `zonot sync`')}`
              : `  sync: ${s.muted('no repo configured — `zonot init --repo=…`')}`,
        );
      }
      return lines.join('\n');
    },
  );
  return EXIT.ok;
}

export function cmdWorkspaces(args: ParsedArgs): number {
  assertKnownArgs(args, 'workspaces', new Set(), 0);
  const config = loadConfig();
  const s = makeStyle(args);
  const rows = Object.entries(config.workspaces).map(([name, ws]) => ({
    name,
    backend: ws.backend,
    default: name === config.default_workspace,
  }));
  emitLines(args, rows, (r) => {
    const row = r as (typeof rows)[number];
    return `${row.default ? s.accent('*') : ' '} ${row.name} ${s.muted(`(${row.backend})`)}`;
  });
  if (rows.length === 0 && !wantJson(args) && args.flags.quiet !== true) {
    process.stdout.write(`${s.muted('no workspaces configured — run `zonot init`')}\n`);
  }
  return EXIT.ok;
}

// --- helpers ---------------------------------------------------------------

function emitWrite(args: ParsedArgs, result: WriteResult, verb: string): void {
  const s = makeStyle(args);
  emit(args, result, () => `${s.accent('✓')} ${verb}  ${result.path}  ${s.muted(result.id)}`);
}

function renderNote(args: ParsedArgs, note: NoteRecord): string {
  const s = makeStyle(args);
  const fm = note.frontmatter;
  const head = [
    s.bold(fm.title ?? note.id),
    s.muted(`${note.path}`),
    fm.tags.length ? fm.tags.map((t) => s.accent(`#${t}`)).join(' ') : '',
  ].filter(Boolean);
  return `${head.join('\n')}\n\n${note.body_compiled.trimEnd()}${note.body_timeline.trim() ? `\n${s.muted('─── timeline ───')}\n${note.body_timeline.trim()}` : ''}`;
}

function notFound(id: string): Error {
  const e = new Error(`note ${id} not found`);
  (e as { name: string }).name = 'NotFoundError';
  return e;
}
