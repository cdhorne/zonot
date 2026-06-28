// Bulk importer (cli-spec §7). Walks a folder of Markdown, synthesizes the
// convention envelope, preserves the verbatim original as a sources/ node, and
// commits in batches with an Imported-From trailer. Commits via isomorphic-git
// directly (batched).
//
// Identity is keyed on (relpath, ctime) — stable across content edits — and the
// target path is resolved by that id, so editing a note's title/date updates it
// in place (honoring path immutability, core-spec §1.4) instead of orphaning the
// old file. Re-importing an unchanged file is a no-op.

import nodeFs, { readdirSync, readFileSync, statSync } from 'node:fs';
import {
  assembleNoteFile,
  assembleSourceFile,
  buildCommitMessage,
  buildNoteFrontmatter,
  buildSourceFrontmatter,
  deriveNotePath,
  deriveSourcePath,
  deterministicUlid,
  generateUlid,
  isValidUlid,
  normalizeTags,
  parseFrontmatterLoose,
  slugify,
} from '@zonot/core';
import git from 'isomorphic-git';
import { parseInline } from './capture-parse.ts';
import { VERSION } from './version.ts';

const SOURCE = `import:zonot@${VERSION}`;
const SKIP_DIRS = new Set(['.git', 'node_modules']);

export type ImportStatus = 'new' | 'update' | 'unchanged';

export interface PlannedNote {
  relpath: string;
  notePath: string;
  sourcePath?: string;
  noteContent: string;
  sourceContent?: string;
  status: ImportStatus;
}

export interface ImportPlan {
  notes: PlannedNote[];
}

export function planImport(root: string, mirrorPath: string): ImportPlan {
  const noteIndex = indexById(mirrorPath, 'notes', (name) => name.slice(0, 26));
  const sourceIndex = indexById(mirrorPath, 'sources', (name) => name.replace(/\.md$/, ''));
  const notes: PlannedNote[] = [];

  for (const rel of discover(root)) {
    const abs = `${root}/${rel}`;
    const raw = readFileSync(abs, 'utf8');
    const st = statSync(abs);
    const { data, body } = parseFrontmatterLoose(raw);

    // Identity anchor = (created, relpath). `created` is the frontmatter date when
    // present (stable — users rarely edit it) → the id is stable across content/
    // title edits, so resolve-by-id finds the existing note. NOT ctime, which a
    // write bumps. The id's ULID timestamp therefore equals `created` (correct).
    const createdMs = resolveCreatedMs(data, st);
    const created = new Date(createdMs).toISOString();
    const id = deterministicUlid(createdMs, rel);
    const title = stringField(data, 'title');
    const tags = normalizeTags([...frontmatterTags(data), ...parseInline(body).tags]);
    const type = stringField(data, 'type') ?? 'note';

    // Resolve the target by id → re-import updates in place, never orphans (§7.5 intent).
    const slug = slugify(title === undefined ? { id } : { title, id });
    const notePath = noteIndex.get(id) ?? deriveNotePath({ id, slug, created });

    // A sources/ node only when the verbatim original differs from the note body
    // (byte-equality rule, ADR-0034 — a frontmatter-less file needs none).
    const noteBody = ensureTrailingNewline(body);
    const rawFull = ensureTrailingNewline(raw);
    let sourcePath: string | undefined;
    let sourceContent: string | undefined;
    let sourceId: string | undefined;
    if (rawFull !== noteBody) {
      sourceId = deterministicUlid(createdMs, `${rel}#source`);
      sourcePath = sourceIndex.get(sourceId) ?? deriveSourcePath({ id: sourceId, created });
      sourceContent = assembleSourceFile(
        buildSourceFrontmatter({ id: sourceId, created, noteId: id, source: SOURCE }),
        rawFull,
      );
    }

    // Provenance (incl. origin relpath) rides in the commit trailer, never
    // frontmatter (ADR-0007). Notes carry no workspace.
    const noteFm = buildNoteFrontmatter({
      id,
      created,
      output: { ...(title !== undefined ? { title } : {}), tags, type },
      ...(sourceId ? { sourceId } : {}),
    });
    const noteContent = assembleNoteFile(noteFm, noteBody);

    notes.push({
      relpath: rel,
      notePath,
      ...(sourcePath ? { sourcePath } : {}),
      noteContent,
      ...(sourceContent ? { sourceContent } : {}),
      status: classify(mirrorPath, notePath, noteContent, noteIndex.has(id)),
    });
  }

  return { notes };
}

/** Execute a plan: write changed files and commit in batches with Imported-From. */
export async function runImport(
  plan: ImportPlan,
  mirrorPath: string,
  author: { name: string; email: string },
  batchSize: number,
): Promise<{ written: number; unchanged: number; commits: number }> {
  const changed = plan.notes.filter((n) => n.status !== 'unchanged');
  let commits = 0;
  for (let i = 0; i < changed.length; i += batchSize) {
    const batch = changed.slice(i, i + batchSize);
    for (const note of batch) {
      writeFile(mirrorPath, note.notePath, note.noteContent);
      await git.add({ fs: nodeFs, dir: mirrorPath, filepath: note.notePath });
      if (note.sourcePath && note.sourceContent) {
        writeFile(mirrorPath, note.sourcePath, note.sourceContent);
        await git.add({ fs: nodeFs, dir: mirrorPath, filepath: note.sourcePath });
      }
    }
    await git.commit({
      fs: nodeFs,
      dir: mirrorPath,
      author,
      message: buildCommitMessage({
        subject: `import: ${batch.length} note${batch.length === 1 ? '' : 's'}`,
        // Per-note origins preserved here (comma-joined for a batch).
        trailers: {
          source: SOURCE,
          captureId: generateUlid(),
          importedFrom: batch.map((n) => n.relpath).join(', '),
        },
      }),
    });
    commits++;
  }
  return { written: changed.length, unchanged: plan.notes.length - changed.length, commits };
}

// --- discovery + synthesis helpers -----------------------------------------

/** Recursively list .md files, skipping .git/node_modules and hidden dirs. */
function discover(root: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of readdirSync(rel ? `${root}/${rel}` : root, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(childRel);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(childRel);
      }
    }
  };
  walk('');
  return out.sort();
}

/** Map existing note/source id → its repo-relative path, for resolve-by-id. */
function indexById(
  mirrorPath: string,
  sub: string,
  idOf: (name: string) => string,
): Map<string, string> {
  const map = new Map<string, string>();
  const root = `${mirrorPath}/${sub}`;
  let entries: string[];
  try {
    entries = readdirSync(root, { recursive: true }) as string[];
  } catch {
    return map;
  }
  for (const p of entries) {
    if (typeof p !== 'string' || !p.endsWith('.md')) continue;
    const rel = p.replaceAll('\\', '/');
    const id = idOf(rel.slice(rel.lastIndexOf('/') + 1));
    if (isValidUlid(id)) map.set(id, `${sub}/${rel}`);
  }
  return map;
}

/** `created` in ms: frontmatter date/created → file ctime → mtime. */
function resolveCreatedMs(
  data: Record<string, unknown>,
  st: { ctimeMs: number; mtimeMs: number },
): number {
  const fm = stringField(data, 'created') ?? stringField(data, 'date');
  if (fm) {
    const t = Date.parse(fm);
    if (!Number.isNaN(t)) return t;
  }
  return Math.floor(st.ctimeMs || st.mtimeMs);
}

function classify(
  mirrorPath: string,
  notePath: string,
  content: string,
  existed: boolean,
): ImportStatus {
  if (!existed) return 'new';
  try {
    return readFileSync(`${mirrorPath}/${notePath}`, 'utf8') === content ? 'unchanged' : 'update';
  } catch {
    return 'update';
  }
}

function frontmatterTags(data: Record<string, unknown>): string[] {
  const t = data.tags;
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === 'string') return t.split(',').map((s) => s.trim());
  return [];
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const v = data[key];
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function writeFile(mirrorPath: string, relpath: string, content: string): void {
  const abs = `${mirrorPath}/${relpath}`;
  nodeFs.mkdirSync(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
  nodeFs.writeFileSync(abs, content);
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`;
}
