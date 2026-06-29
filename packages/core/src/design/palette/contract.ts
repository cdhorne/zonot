// PaletteContract — the primitives every palette must supply (mobile-spec §1.4).
// Semantic role tokens (semantic.ts) resolve from these; re-branding swaps the
// palette module and the roles auto-resolve. Plain data — web-standard, so the
// vocabulary is shared by the mobile Restyle theme AND the CLI's ANSI mapper.

export type NeutralStep = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

export interface PaletteContract {
  /** Brand/accent primitives (accent.solid / .muted / .text resolve here). */
  brand: {
    solid: string;
    /** Low-emphasis accent bg in light mode. */
    muted: string;
    /** Low-emphasis accent bg in dark mode (a translucent accent over dark surfaces). */
    mutedDark: string;
    text: string;
  };
  /** Bright→dark neutral ramp; surfaces/text/borders pick steps per mode. */
  neutral: Record<NeutralStep, string>;
  /** Conventional status hues (success/warning/danger/info). */
  status: {
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
}

export type Mode = 'light' | 'dark';
