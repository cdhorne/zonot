// Note/source file <-> record helpers (the inverse of the serializer).
//
// Assembly uses the bespoke byte-deterministic serializer (frontmatter-serialize),
// so written bytes stay conformance-locked. Parsing uses the `yaml` lib (eemeli)
// because read-back must tolerate files a human edited in Obsidian — general YAML,
// not just our own output (ROADMAP "port the yaml lib"; ADR-0022).
//
// raw_body is preserved verbatim on parse (exact round-trip); body_compiled /
// body_timeline are the splitBody view over it (core-spec §1.6).

import { parse as parseYaml } from 'yaml';
import { NoteFileParseError } from '../errors/index.ts';
import {
  type NoteFrontmatter,
  noteFrontmatterSchema,
  type SourceFrontmatter,
  sourceFrontmatterSchema,
} from '../schema/index.ts';
import { splitBody } from './body.ts';
import { serializeNoteFrontmatter, serializeSourceFrontmatter } from './frontmatter-serialize.ts';

type Json = Parameters<typeof serializeNoteFrontmatter>[0][string];

// --- assemble (record -> file bytes) ---------------------------------------

/** Full note-file bytes: byte-deterministic frontmatter block + verbatim body. */
export function assembleNoteFile(frontmatter: NoteFrontmatter, body: string): string {
  return serializeNoteFrontmatter(frontmatter as Record<string, Json | undefined>) + body;
}

/** Full source-file bytes: byte-deterministic frontmatter block + verbatim body. */
export function assembleSourceFile(frontmatter: SourceFrontmatter, body: string): string {
  return serializeSourceFrontmatter(frontmatter as Record<string, Json | undefined>) + body;
}

// --- parse (file bytes -> record) ------------------------------------------

export interface ParsedNoteFile {
  frontmatter: NoteFrontmatter;
  raw_body: string;
  body_compiled: string;
  body_timeline: string;
}

export interface ParsedSourceFile {
  frontmatter: SourceFrontmatter;
  body: string;
}

/**
 * Tolerantly split a leading `---` frontmatter block from arbitrary Markdown
 * (e.g. a file being imported). Returns the raw YAML object (no schema check)
 * and the body. Missing/malformed/unterminated frontmatter → `{ data: {}, body }`.
 * Used by the importer (cli-spec §7.2); parseNoteFile is the strict counterpart.
 */
export function parseFrontmatterLoose(content: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const lines = content.split('\n');
  if ((lines[0] ?? '').trim() !== '---') return { data: {}, body: content };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? '').trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return { data: {}, body: content };
  const body = lines.slice(end + 1).join('\n');
  try {
    const parsed = parseYaml(lines.slice(1, end).join('\n'));
    return {
      data: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {},
      body,
    };
  } catch {
    return { data: {}, body };
  }
}

export function parseNoteFile(content: string, path = '<note>'): ParsedNoteFile {
  const { yamlSrc, body } = splitFrontmatter(content, path);
  const data = parseYamlBlock(yamlSrc, path);
  const result = noteFrontmatterSchema.safeParse(data);
  if (!result.success) {
    throw new NoteFileParseError(path, zodIssues(result.error));
  }
  const split = splitBody(body);
  return {
    frontmatter: result.data,
    raw_body: body,
    body_compiled: split.compiled,
    body_timeline: split.timeline,
  };
}

export function parseSourceFile(content: string, path = '<source>'): ParsedSourceFile {
  const { yamlSrc, body } = splitFrontmatter(content, path);
  const data = parseYamlBlock(yamlSrc, path);
  const result = sourceFrontmatterSchema.safeParse(data);
  if (!result.success) {
    throw new NoteFileParseError(path, zodIssues(result.error));
  }
  return { frontmatter: result.data, body };
}

// --- internals -------------------------------------------------------------

/** Split the leading `---`-delimited frontmatter block from the body. */
function splitFrontmatter(content: string, path: string): { yamlSrc: string; body: string } {
  const lines = content.split('\n');
  if ((lines[0] ?? '').trim() !== '---') {
    throw new NoteFileParseError(path, 'missing leading frontmatter block');
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? '').trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new NoteFileParseError(path, 'unterminated frontmatter block');
  }
  return {
    yamlSrc: lines.slice(1, end).join('\n'),
    body: lines.slice(end + 1).join('\n'), // verbatim round-trip
  };
}

function parseYamlBlock(yamlSrc: string, path: string): unknown {
  try {
    return parseYaml(yamlSrc) ?? {};
  } catch (err) {
    throw new NoteFileParseError(path, `malformed YAML: ${(err as Error).message}`);
  }
}

function zodIssues(error: {
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>;
}): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}
