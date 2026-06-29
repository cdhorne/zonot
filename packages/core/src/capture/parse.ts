// The capture chip parser (mobile-spec §2.2). Extracts #tag / @thread / !type
// tokens from a capture body and surfaces them as chips, WITHOUT mutating the
// body (LEAVE-in-body discipline). Tokens inside fenced code blocks are ignored
// (code is verbatim). Tags accumulate (deduped); @thread is last-wins (one
// allowed); !type is first-wins with `context` rejected (source-only).
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

// Reserved type values that are valid on a source node but rejected in a capture.
const RESERVED_TYPES = new Set(['context']);

// A facet token: a sigil then a letter/number-led slug. The slug class excludes
// the spec's terminators (whitespace, `)`, `.`, `,`, `;`) so they end the token.
const TOKEN = /([#@!])([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;
const TITLE_MAX = 80;

export function parseCapture(body: string): ParsedCapture {
  const fenced = fencedRanges(body);
  const tags: string[] = [];
  const tagChips = new Map<string, ChipSpec>(); // value → chip (first occurrence)
  const dangerChips = new Map<string, ChipSpec>(); // value → rejected chip
  let threadChip: ChipSpec | undefined;
  let typeChip: ChipSpec | undefined;
  let thread: string | undefined;
  let type: string | undefined;

  for (const m of body.matchAll(TOKEN)) {
    const start = m.index;
    // Boundary: token must follow start-of-string, whitespace, or `(`.
    const prev = start > 0 ? body[start - 1] : ' ';
    if (prev !== undefined && !/\s/.test(prev) && prev !== '(') continue;
    if (inRange(start, fenced)) continue;

    const entry = SIGILS[m[1] as string];
    if (!entry) continue;
    const value = normalizeTags([m[2] as string])[0];
    if (!value) continue;
    const range: [number, number] = [start, start + m[0].length];

    if (entry.kind === 'tag') {
      if (!tagChips.has(value)) {
        tags.push(value);
        tagChips.set(value, chip('tag', value, '#', range, true));
      }
    } else if (entry.kind === 'thread') {
      thread = value; // last-wins
      threadChip = chip('thread', value, '@', range, true);
    } else if (RESERVED_TYPES.has(value)) {
      // Source-only type — reject with a danger chip; never sets frontmatter type.
      if (!dangerChips.has(value))
        dangerChips.set(value, chip('type', value, '!', range, false, true));
    } else if (typeChip === undefined) {
      type = value; // first-wins among valid types
      typeChip = chip('type', value, '!', range, true);
    }
  }

  const chips = [
    ...tagChips.values(),
    ...(threadChip ? [threadChip] : []),
    ...(typeChip ? [typeChip] : []),
    ...dangerChips.values(),
  ].sort((a, b) => a.range[0] - b.range[0]); // body-position order, first-seen leftmost

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

function chip(
  kind: ChipKind,
  value: string,
  sigil: '#' | '@' | '!',
  range: [number, number],
  enabled: boolean,
  invalid = false,
): ChipSpec {
  return {
    id: `${kind}-${value}`, // stable while the value persists across keystrokes
    kind,
    value,
    sigil,
    enabled,
    range,
    ...(invalid ? { invalid: true } : {}),
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
