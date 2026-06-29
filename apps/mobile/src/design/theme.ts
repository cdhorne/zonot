// The Restyle theme — composes the web-standard core design tokens (@zonot/core/
// design) into a React Native theme (mobile-spec §1.2). Components reference
// semantic roles only (textPrimary, accentSolid, …), never palette primitives.

import { createTheme } from '@shopify/restyle';
import {
  type Mode,
  radii,
  type SemanticColors,
  semanticColors,
  space,
  spacing,
  typeScale,
  zonotPalette,
} from '@zonot/core/design';

function flattenColors(c: SemanticColors): Record<string, string> {
  return {
    surfaceCanvas: c.surface.canvas,
    surfaceRaised: c.surface.raised,
    surfaceSunken: c.surface.sunken,
    surfaceOverlay: c.surface.overlay,
    textPrimary: c.text.primary,
    textMuted: c.text.muted,
    textSubtle: c.text.subtle,
    textInverse: c.text.inverse,
    textLink: c.text.link,
    borderSubtle: c.border.subtle,
    borderDefault: c.border.default,
    borderStrong: c.border.strong,
    accentSolid: c.accent.solid,
    accentMuted: c.accent.muted,
    accentText: c.accent.text,
    statusSuccess: c.status.success,
    statusWarning: c.status.warning,
    statusDanger: c.status.danger,
    statusInfo: c.status.info,
  };
}

export function buildTheme(mode: Mode) {
  return createTheme({
    colors: flattenColors(semanticColors(zonotPalette, mode)),
    spacing: { ...space, ...spacing },
    borderRadii: radii,
    breakpoints: { phone: 0, tablet: 768 },
    textVariants: {
      defaults: typeScale.body,
      display: typeScale.display,
      heading1: typeScale.heading1,
      heading2: typeScale.heading2,
      body: typeScale.body,
      bodySmall: typeScale.bodySmall,
      mono: typeScale.mono,
      monoSmall: typeScale.monoSmall,
    },
  });
}

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');
export type Theme = typeof lightTheme;
