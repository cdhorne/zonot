// Design tokens — web-standard data + types (mobile-spec §1.2). The mobile app
// composes these into a Restyle theme; the CLI maps the colour roles to ANSI.
// No RN/Restyle import here — the kernel stays web-standard (ADR-0028).

export type { Mode, NeutralStep, PaletteContract } from './palette/contract.ts';
export { zonotPalette } from './palette/zonot.ts';
export * from './scale.ts';
export { type SemanticColors, semanticColors } from './semantic.ts';
