// Themed primitives (mobile-spec §1.1). Box/Text are the only building blocks
// screens use for layout + type — never raw View/Text with inline colours.

import { createBox, createText, useTheme as useRestyleTheme } from '@shopify/restyle';
import type { Theme } from './theme.ts';

export const Box = createBox<Theme>();
export const Text = createText<Theme>();
export const useTheme = useRestyleTheme<Theme>;
