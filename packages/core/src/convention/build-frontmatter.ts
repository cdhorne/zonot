// Frontmatter builders — assemble a NoteFrontmatter / SourceFrontmatter
// from a raw capture input plus the injected clock + id. Pure functions;
// no I/O. The shape they produce is what the serializer consumes for
// byte-identical output across runtimes (ADR-0011 / docs/specs/core-spec.md §4).

import type { NoteFrontmatter, SourceFrontmatter } from '../schema/index.ts';
import { normalizeTags } from './normalize-tags.ts';

export interface BuildNoteFrontmatterInput {
  id: string;
  created: string;
  workspace?: string | undefined;
  thread?: string | undefined;
  output: {
    title?: string | undefined;
    tags?: ReadonlyArray<string> | undefined;
    type?: string | undefined;
  };
  /** A source-node id that this note's `source` field should point at. */
  sourceId?: string | undefined;
  /** Tolerant extension keys (preserved at the tail in input-order). */
  extra?: Record<string, unknown> | undefined;
}

export function buildNoteFrontmatter(input: BuildNoteFrontmatterInput): NoteFrontmatter {
  const fm: NoteFrontmatter = {
    id: input.id,
    v: 1,
    created: input.created,
    tags: normalizeTags(input.output.tags ?? []),
  };
  if (input.output.type !== undefined) fm.type = input.output.type;
  if (input.thread !== undefined) fm.thread = input.thread;
  if (input.output.title !== undefined) fm.title = input.output.title;
  if (input.workspace !== undefined) fm.workspace = input.workspace;
  if (input.sourceId !== undefined) fm.source = input.sourceId;
  if (input.extra) {
    for (const [k, v] of Object.entries(input.extra)) {
      if (v !== undefined && !(k in fm)) {
        (fm as Record<string, unknown>)[k] = v;
      }
    }
  }
  return fm;
}

export interface BuildSourceFrontmatterInput {
  id: string;
  created: string;
  noteId?: string | undefined;
  source?: string | undefined;
  model?: string | undefined;
  workspace?: string | undefined;
  extra?: Record<string, unknown> | undefined;
}

export function buildSourceFrontmatter(input: BuildSourceFrontmatterInput): SourceFrontmatter {
  const fm: SourceFrontmatter = {
    id: input.id,
    v: 1,
    type: 'context',
    created: input.created,
  };
  if (input.noteId !== undefined) fm.of = input.noteId;
  if (input.source !== undefined) fm.source = input.source;
  if (input.model !== undefined) fm.model = input.model;
  if (input.workspace !== undefined) fm.workspace = input.workspace;
  if (input.extra) {
    for (const [k, v] of Object.entries(input.extra)) {
      if (v !== undefined && !(k in fm)) {
        (fm as Record<string, unknown>)[k] = v;
      }
    }
  }
  return fm;
}
