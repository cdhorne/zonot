// Chip-strip state for the capture screen (mobile-spec §2.2–2.3). Debounces the
// core parseCapture over the body (250 ms window) and tracks which chips the
// user has toggled off — toggling flips the "include in frontmatter" decision
// WITHOUT mutating the body. Returns the effective facets to submit.

import { parseCapture } from '@zonot/core/capture';
import type { ChipSpec } from '@zonot/core/schema';
import { useEffect, useMemo, useRef, useState } from 'react';

const DEBOUNCE_MS = 250;

export interface Facets {
  title: string | undefined;
  tags: string[];
  thread: string | undefined;
  type: string | undefined;
}

export interface ChipState {
  chips: ChipSpec[]; // enabled reflects the toggle state
  toggle: (id: string) => void;
  /** Effective facets from a *fresh* parse of `text`, honoring toggles. Call at
   *  save so a capture within the debounce window keeps its facets (spec §2.2:
   *  "apply at save AND debounced during typing"). */
  resolve: (text: string) => Facets;
}

/** Effective facets from a parsed body, excluding toggled-off + invalid chips. */
function facetsFrom(chips: ChipSpec[], title: string | undefined): Facets {
  const live = chips.filter((c) => c.enabled && !c.invalid);
  return {
    title,
    tags: live.filter((c) => c.kind === 'tag').map((c) => c.value),
    thread: live.find((c) => c.kind === 'thread')?.value,
    type: live.find((c) => c.kind === 'type')?.value,
  };
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
    () => parsed.chips.map((c) => ({ ...c, enabled: c.invalid ? false : !disabled.has(c.id) })),
    [parsed, disabled],
  );

  const toggle = (id: string) =>
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Re-parse the latest body at save and re-apply the toggle state, so a save
  // inside the debounce window submits the current facets — not the stale ones.
  const resolve = (text: string): Facets => {
    const fresh = parseCapture(text);
    const withToggles = fresh.chips.map((c) => ({
      ...c,
      enabled: c.invalid ? false : !disabled.has(c.id),
    }));
    return facetsFrom(withToggles, fresh.title);
  };

  return { chips, toggle, resolve };
}
