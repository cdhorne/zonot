import { z } from 'zod';

// One parsed inline token from the body, surfaced as a chip on the capture screen
// (docs/specs/mobile-spec.md §2.2 / ADR-0034 rev 5).
export const chipKindSchema = z.enum(['tag', 'thread', 'type']);
export type ChipKind = z.infer<typeof chipKindSchema>;

export const chipSpecSchema = z.object({
  id: z.string(), // stable across keystrokes for animation reconciliation
  kind: chipKindSchema,
  value: z.string(), // the normalized slug
  sigil: z.enum(['#', '@', '!']),
  enabled: z.boolean(),
  range: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  // A recognized-but-rejected token (e.g. the source-only `!context`); the UI
  // renders it in a `danger` state and it contributes nothing to frontmatter.
  invalid: z.boolean().optional(),
});
export type ChipSpec = z.infer<typeof chipSpecSchema>;

// The output shape submitted as part of a capture (the client's view of the
// note's body + facets at submit time).
export const captureOutputSchema = z.object({
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  type: z.string().optional(), // default 'note' applied at the convention layer
  body: z.string(),
});
export type CaptureOutput = z.infer<typeof captureOutputSchema>;

// Result of running the inline-token parser over a capture's body.
// LEAVE-in-body discipline: chips carry frontmatter intent, body text is unchanged.
export const parsedCaptureSchema = z.object({
  body: z.string(),
  tags: z.array(z.string()),
  thread: z.string().optional(),
  type: z.string().optional(),
  title: z.string().optional(),
  chips: z.array(chipSpecSchema),
});
export type ParsedCapture = z.infer<typeof parsedCaptureSchema>;

// Capture op input — MCP / HTTP request body.
export const captureInputSchema = z.object({
  workspace: z.string(),
  output: captureOutputSchema,
  // Verbatim raw payload (e.g. share-extension input, voice transcription).
  // Materialized to a sources/ node only when distinct from output.body
  // (ADR-0034 rev 6 / docs/specs/core-spec.md §3.5).
  raw: z.string().optional(),
  thread: z.string().optional(),
  idempotency_key: z.string().optional(),
});
export type CaptureInput = z.infer<typeof captureInputSchema>;
