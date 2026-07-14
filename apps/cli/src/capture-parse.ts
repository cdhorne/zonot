// Inline facet parser (cli-spec §1.2, matches the mobile parser intent). Extracts
// #tag / @thread / !type tokens to carry frontmatter intent. LEAVE-in-body
// discipline: the body text is returned unchanged — tokens stay where the user
// typed them. Single thread/type per note (ADR-0005); @thread is last-wins,
// !type is first-wins — matches core's parseCapture (packages/core/src/capture/parse.ts).

import { normalizeTags } from '@zonot/core';

export interface InlineFacets {
  tags: string[];
  thread?: string;
  type?: string;
}

// #tag requires an alphabetic start so bare numeric refs (`#39`, a GitHub issue
// link in prose) stay body text, not a tag (issue #10).
const TAG = /(?:^|\s)#([\p{L}][\p{L}\p{N}_-]*)/gu;
// @thread is global so matchAll sees every occurrence — last-wins per ADR-0005
// (issue #12). The digit-or-letter start is intentional here (unlike #tag).
const THREAD = /(?:^|\s)@([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;
const TYPE = /(?:^|\s)!([\p{L}\p{N}][\p{L}\p{N}_-]*)/u;

export function parseInline(body: string): InlineFacets {
  const tags = normalizeTags([...body.matchAll(TAG)].map((m) => m[1] as string));
  const threadMatches = [...body.matchAll(THREAD)];
  const thread = normalizeTags([threadMatches.at(-1)?.[1] ?? ''])[0];
  const type = normalizeTags([TYPE.exec(body)?.[1] ?? ''])[0];
  return { tags, ...(thread ? { thread } : {}), ...(type ? { type } : {}) };
}
