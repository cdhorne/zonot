// Non-colour scale tokens (mobile-spec §1.3) — spacing, radii, type, motion,
// elevation, z-index. Mode-independent; consumed by the Restyle theme + the CLI.

export const space = {
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 12,
  6: 16,
  7: 20,
  8: 24,
  9: 32,
  10: 40,
  11: 48,
  12: 64,
} as const;

/** Semantic spacing aliases (map onto the numeric primitives). */
export const spacing = {
  tight: space[2],
  cozy: space[4],
  default: space[6],
  comfy: space[8],
  loose: space[10],
} as const;

export const radii = { none: 0, sm: 4, md: 8, lg: 16, full: 9999 } as const;

export const typeScale = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  heading1: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading2: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  mono: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  monoSmall: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const;

export const motion = {
  duration: { fast: 150, default: 250, slow: 400 },
  easing: { standard: 'ease-in-out', decelerate: 'ease-out', accelerate: 'ease-in' },
} as const;

export const elevation = { none: 0, subtle: 1, raised: 4, floating: 12 } as const;

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
} as const;
