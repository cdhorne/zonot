// Storage-agnostic write logic shared by both WriteClient backends (GitHub REST
// and isomorphic-git). These build the convention-correct file bytes + frontmatter
// for each op; the backends only differ in HOW they persist + commit them.
// Pure functions — no I/O.

import {
  assembleNoteFile,
  assembleSourceFile,
  buildNoteFrontmatter,
  buildSourceFrontmatter,
  deriveNotePath,
  deriveSourcePath,
  normalizeTags,
  type parseNoteFile,
  slugify,
  splitBody,
} from '../convention/index.ts';
import type { CaptureInput, CaptureOutput, NoteFrontmatter } from '../schema/index.ts';

type ParsedNote = ReturnType<typeof parseNoteFile>;

export interface PreparedFile {
  path: string;
  content: string;
}

export interface PreparedCapture {
  note: PreparedFile;
  source?: PreparedFile;
  applied_tags: string[];
}

export interface PreparedEdit {
  body: string;
  frontmatter: NoteFrontmatter;
}

/** Build the note (and optional source) files for a capture. */
export function prepareCapture(
  input: CaptureInput,
  deps: { id: string; created: string; source: string; newSourceId: () => string },
): PreparedCapture {
  const { id, created } = deps;
  const slug = slugify(
    input.output.title === undefined ? { id } : { title: input.output.title, id },
  );
  const notePath = deriveNotePath({ id, slug, created });

  // A source node is written iff a distinct verbatim `raw` was supplied
  // (core-spec §3.5 / §6 — byte-identical raw+body writes no source node).
  let source: PreparedFile | undefined;
  let sourceId: string | undefined;
  if (input.raw !== undefined && input.raw !== input.output.body) {
    sourceId = deps.newSourceId();
    const sfm = buildSourceFrontmatter({ id: sourceId, created, noteId: id, source: deps.source });
    source = {
      path: deriveSourcePath({ id: sourceId, created }),
      content: assembleSourceFile(sfm, ensureTrailingNewline(input.raw)),
    };
  }

  const fm = buildNoteFrontmatter({
    id,
    created,
    workspace: input.workspace,
    thread: input.thread,
    output: input.output,
    sourceId,
  });
  const note = {
    path: notePath,
    content: assembleNoteFile(fm, ensureBodyShape(input.output.body)),
  };
  return source ? { note, source, applied_tags: fm.tags } : { note, applied_tags: fm.tags };
}

/** Append a dated block to a note's timeline (below the first divider). */
export function prepareAppend(parsed: ParsedNote, block: string, now: string): PreparedEdit {
  const compiled = parsed.body_compiled.replace(/\n+$/, '');
  const existing = parsed.body_timeline.replace(/^\n+/, '').replace(/\n+$/, '');
  const blk = block.replace(/\n+$/, '');
  const timeline = existing ? `${existing}\n${blk}` : blk;
  return {
    body: `${compiled}\n\n---\n\n${timeline}\n`,
    frontmatter: { ...parsed.frontmatter, updated: now },
  };
}

/** Replace a note's compiled body (timeline preserved), updating only the
 *  facets the correction supplies; all other frontmatter survives (ADR-0005). */
export function prepareCorrect(
  parsed: ParsedNote,
  output: CaptureOutput,
  now: string,
): PreparedEdit {
  // A divider inside output.body is a cut point — content below it is dropped.
  const newCompiled = splitBody(output.body).compiled.replace(/\n+$/, '');
  const timeline = parsed.body_timeline.replace(/^\n+/, '').replace(/\n+$/, '');
  const body = timeline ? `${newCompiled}\n\n---\n\n${timeline}\n` : `${newCompiled}\n`;

  const frontmatter = { ...parsed.frontmatter, updated: now };
  if (output.title !== undefined) frontmatter.title = output.title;
  if (output.type !== undefined) frontmatter.type = output.type;
  if (output.tags !== undefined) frontmatter.tags = normalizeTags(output.tags);
  return { body, frontmatter };
}

/** A capture body always ends with a newline; an empty body becomes one blank line. */
export function ensureBodyShape(body: string): string {
  return body === '' ? '\n' : ensureTrailingNewline(body);
}

export function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`;
}

/** Single-line commit subject; collapses whitespace, falls back to the id. */
export function commitSubject(verb: string, title: string | undefined, id: string): string {
  const t = title?.replace(/\s+/g, ' ').trim();
  return t ? `${verb}: ${t}` : `${verb}: ${id}`;
}
