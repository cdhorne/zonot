// Chip-strip state for the capture screen (mobile-spec §2.2–2.3). Debounces the
// core parseCapture over the body (250 ms window) and tracks which chips the
// user has toggled off — toggling flips the "include in frontmatter" decision
// WITHOUT mutating the body. Returns the effective facets to submit.

import { parseCapture } from '@zonot/core/capture';
import type { ChipSpec } from '@zonot/core/schema';
import { useEffect, useMemo, useRef, useState } from 'react';

const DEBOUNCE_MS = 250;

export interface ChipState {
  chips: ChipSpec[]; // enabled reflects the toggle state
  toggle: (id: string) => void;
  title: string | undefined;
  tags: string[];
  thread: string | undefined;
  type: string | undefined;
}

export function useChips(body: string): ChipState {
  const [parsed, setParsed] = useState(() => parseCapture(''));
  const [disabled, setDisabled] = useState<ReadonlySet<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParsed(parseCapture(body)), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [body]);

  const chips = useMemo<ChipSpec[]>(
    () => parsed.chips.map((c) => ({ ...c, enabled: !disabled.has(c.id) })),
    [parsed, disabled],
  );

  const toggle = (id: string) =>
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Effective facets — only enabled chips contribute to frontmatter.
  const enabled = (kind: ChipSpec['kind']) =>
    chips.filter((c) => c.kind === kind && c.enabled).map((c) => c.value);
  const tags = enabled('tag');
  const thread = enabled('thread')[0];
  const type = enabled('type')[0];

  return {
    chips,
    toggle,
    title: parsed.title,
    tags,
    ...(thread !== undefined ? { thread } : { thread: undefined }),
    ...(type !== undefined ? { type } : { type: undefined }),
  };
}
