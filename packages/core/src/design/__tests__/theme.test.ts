import { describe, expect, test } from 'bun:test';
import {
  radii,
  type SemanticColors,
  semanticColors,
  space,
  typeScale,
  zIndex,
  zonotPalette,
} from '../index.ts';

// Conformance (mobile-spec §1.2): every semantic colour token resolves to a
// concrete value in BOTH modes — no undefined, no empty string — so a re-brand
// (swap the palette) can't leave a hole.
const GROUPS: Record<keyof SemanticColors, string[]> = {
  surface: ['canvas', 'raised', 'sunken', 'overlay'],
  text: ['primary', 'muted', 'subtle', 'inverse', 'link'],
  border: ['subtle', 'default', 'strong'],
  accent: ['solid', 'muted', 'text'],
  status: ['success', 'warning', 'danger', 'info'],
};

describe('theme conformance', () => {
  test.each(['light', 'dark'] as const)('every semantic token resolves in %s mode', (mode) => {
    const c = semanticColors(zonotPalette, mode) as unknown as Record<
      string,
      Record<string, string>
    >;
    let count = 0;
    for (const [group, keys] of Object.entries(GROUPS)) {
      for (const key of keys) {
        const value = c[group]?.[key];
        expect(typeof value === 'string' && value.length > 0).toBe(true);
        count++;
      }
    }
    expect(count).toBe(19); // the full enumerated vocabulary (§1.3 lists 19; its "18" header miscounts)
  });

  test('light and dark differ (two resolutions, not one)', () => {
    expect(semanticColors(zonotPalette, 'light').surface.canvas).not.toBe(
      semanticColors(zonotPalette, 'dark').surface.canvas,
    );
  });

  test('scale tokens are present + sane', () => {
    expect(space[0]).toBe(0);
    expect(space[12]).toBe(64);
    expect(radii.full).toBeGreaterThan(radii.lg);
    expect(zIndex.toast).toBeGreaterThan(zIndex.base);
    expect(typeScale.body.fontSize).toBe(16);
  });
});
