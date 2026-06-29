// Semantic colour roles (mobile-spec §1.3) — the only colours components reference
// (never palette primitives). Light + dark are two resolutions of the same
// vocabulary, built from a PaletteContract. 19 tokens.

import type { Mode, PaletteContract } from './palette/contract.ts';

export interface SemanticColors {
  surface: { canvas: string; raised: string; sunken: string; overlay: string };
  text: { primary: string; muted: string; subtle: string; inverse: string; link: string };
  border: { subtle: string; default: string; strong: string };
  accent: { solid: string; muted: string; text: string };
  status: { success: string; warning: string; danger: string; info: string };
}

export function semanticColors(p: PaletteContract, mode: Mode): SemanticColors {
  const n = p.neutral;
  const status = { ...p.status };
  const accent = { solid: p.brand.solid, text: p.brand.text };

  if (mode === 'light') {
    return {
      surface: { canvas: n[50], raised: '#ffffff', sunken: n[100], overlay: 'rgba(9,9,11,0.4)' },
      text: { primary: n[900], muted: n[500], subtle: n[400], inverse: n[50], link: p.brand.text },
      border: { subtle: n[200], default: n[300], strong: p.brand.solid },
      accent: { ...accent, muted: p.brand.muted },
      status,
    };
  }
  return {
    surface: { canvas: n[950], raised: n[900], sunken: n[800], overlay: 'rgba(0,0,0,0.6)' },
    text: { primary: n[50], muted: n[400], subtle: n[500], inverse: n[900], link: p.brand.text },
    border: { subtle: n[800], default: n[700], strong: p.brand.solid },
    accent: { ...accent, muted: p.brand.mutedDark },
    status,
  };
}
