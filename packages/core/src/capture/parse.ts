// The capture chip parser (mobile-spec §2.2). Extracts #tag / @thread / !type
// tokens from a capture body and surfaces them as chips, WITHOUT mutating the
// body (LEAVE-in-body discipline). Tokens inside fenced code blocks are ignored
// (code is verbatim). Single thread/type per note, first wins (ADR-0005).
//
// Lives in the core so the convention (token grammar, normalization, title
// inference) is single-sourced and bun-testable — the RN capture screen renders
// the chips, this decides them.

import { normalizeTags } from '../convention/index.ts';
import type { ChipKind, ChipSpec, ParsedCapture } from '../schema/index.ts';

const SIGILS: Record<string, { kind: ChipKind; sigil: '#' | '@' | '!' }> = {
  '#': { kind: 'tag', sigil: '#' },
  '@': { kind: 'thread', sigil: '@' },
  '!': { kind: 'type', sigil: '!' },
};

// A facet token: a sigil at a word boundary, then a letter/number-led slug.
const TOKEN = /([#@!])([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;
const TITLE_MAX = 80;

export function parseCapture(body: string): ParsedCapture {
  const fenced = fencedRanges(body);
  const tags: string[] = [];
  const chips: ChipSpec[] = [];
  const seen = new Set<string>(); // `${kind}:${value}` — one chip per facet
  let thread: string | undefined;
  let type: string | undefined;

  for (const m of body.matchAll(TOKEN)) {
    const start = m.index;
    // Token must sit at a boundary (start-of-string or whitespace before).
    const prev = start > 0 ? body[start - 1] : ' ';
    if (prev !== undefined && !/\s/.test(prev)) continue;
    if (inRange(start, fenced)) continue;

    const entry = SIGILS[m[1] as string];
    if (!entry) continue;
    const { kind } = entry;
    const value = normalizeTags([m[2] as string])[0];
    if (!value) continue;

    // Single thread/type, first wins; tags accumulate (deduped).
    if (kind === 'thread') {
      if (thread !== undefined) continue;
      thread = value;
    } else if (kind === 'type') {
      if (type !== undefined) continue;
      type = value;
    } else {
      if (seen.has(`tag:${value}`)) continue;
      tags.push(value);
    }
    const key = `${kind}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);

    chips.push({
      id: `${kind}-${value}`, // stable while the value persists across keystrokes
      kind,
      value,
      sigil: entry.sigil,
      enabled: true,
      range: [start, start + m[0].length],
    });
  }

  const title = inferTitle(body);
  return {
    body,
    tags,
    chips,
    ...(thread !== undefined ? { thread } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(title !== undefined ? { title } : {}),
  };
}

/** First non-empty line as the title: an H1's text, else a short period-free line. */
function inferTitle(body: string): string | undefined {
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const h1 = /^#\s+(.+)$/.exec(trimmed);
    if (h1) {
      const text = (h1[1] as string).trim();
      return text.length > 0 && text.length <= TITLE_MAX ? text : undefined;
    }
    if (trimmed.length <= TITLE_MAX && !trimmed.endsWith('.')) return trimmed;
    return undefined;
  }
  return undefined;
}

/** Char ranges covered by fenced code blocks (``` / ~~~), including fence lines. */
function fencedRanges(body: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let offset = 0;
  let open: '`' | '~' | null = null;
  let openStart = 0;
  for (const line of body.split('\n')) {
    const lineEnd = offset + line.length;
    const fence = /^\s*(```+|~~~+)/.exec(line);
    if (fence) {
      const mark = (fence[1] as string)[0] === '`' ? '`' : '~';
      if (open === null) {
        open = mark;
        openStart = offset;
      } else if (open === mark) {
        ranges.push([openStart, lineEnd]);
        open = null;
      }
    }
    offset = lineEnd + 1; // account for the consumed '\n'
  }
  if (open !== null) ranges.push([openStart, body.length]); // unclosed fence → to end
  return ranges;
}

function inRange(pos: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([s, e]) => pos >= s && pos < e);
}
