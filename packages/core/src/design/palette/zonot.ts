// The shipping Zonot palette (brand-bearing). Calm-on-the-surface: deep clear
// blues/teals as the accent (cenote water, not murky), bright/airy neutrals.
// Placeholder values pending a design pass — see mobile-spec §1.1. The semantic
// token names stay neutral so this module is swappable.

import type { PaletteContract } from './contract.ts';

export const zonotPalette: PaletteContract = {
  brand: {
    solid: '#0e7490', // teal-700 — primary action, selected
    muted: '#cffafe', // teal-100 — low-emphasis accent bg
    text: '#0891b2', // teal-600 — accent-colored text
  },
  neutral: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#09090b',
  },
  status: {
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    info: '#2563eb',
  },
};
