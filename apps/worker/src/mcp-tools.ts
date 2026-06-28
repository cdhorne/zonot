// MCP tool definitions over the shared handler set (ADR-0022). Kept free of any
// SDK import so the tool logic is unit-testable in Bun; mcp.ts registers these
// on an McpServer served by the DO-free web-standard Streamable HTTP transport.
//
// Tools mirror the HTTP ops; the workspace comes from the authenticated URL, so
// it is never a tool argument. Provenance Source is `mcp:claude`.

import {
  appendInputSchema,
  captureInputSchema,
  correctInputSchema,
  deleteInputSchema,
  listRecentInputSchema,
  listTagsInputSchema,
  readInputSchema,
  undoInputSchema,
} from '@zonot/core/schema';
import type { z } from 'zod';
import type { Env, WorkspaceContext } from './env.ts';
import {
  runAppend,
  runCapture,
  runCorrect,
  runDelete,
  runInit,
  runListRecent,
  runListTags,
  runReadNote,
  runUndo,
} from './handlers.ts';

const SOURCE = 'mcp:claude';

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  // Mirror the SDK's CallToolResult open shape so this is assignable to it.
  [k: string]: unknown;
}

export interface ToolDef {
  name: string;
  description: string;
  /** Zod raw shape (workspace omitted — it comes from the authenticated URL). */
  shape: z.ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

const omitWorkspace = { workspace: true } as const;

/** Build the tool set bound to one authenticated workspace. */
export function mcpTools(ctx: WorkspaceContext, env: Env): ToolDef[] {
  return [
    {
      name: 'capture',
      description: 'Create a new note (and an optional verbatim source). The default capture op.',
      shape: captureInputSchema.omit(omitWorkspace).shape,
      handler: (a) =>
        wrap(() => runCapture(ctx, env, SOURCE, a, a.idempotency_key as string | undefined)),
    },
    {
      name: 'append',
      description:
        "Append a dated block to a note's timeline. SHA-conditional (base_sha required).",
      shape: appendInputSchema.omit(omitWorkspace).shape,
      handler: (a) =>
        wrap(() =>
          runAppend(ctx, env, SOURCE, a.id as string, a, a.idempotency_key as string | undefined),
        ),
    },
    {
      name: 'correct',
      description: "Replace a note's compiled body (timeline preserved). SHA-conditional.",
      shape: correctInputSchema.omit(omitWorkspace).shape,
      handler: (a) =>
        wrap(() =>
          runCorrect(ctx, env, SOURCE, a.id as string, a, a.idempotency_key as string | undefined),
        ),
    },
    {
      name: 'undo',
      description: 'Remove the note created by a capture (resolved by capture_id). Tidy fumbles.',
      shape: undoInputSchema.omit(omitWorkspace).shape,
      handler: (a) => wrap(() => runUndo(ctx, env, SOURCE, a.capture_id as string, a)),
    },
    {
      name: 'delete',
      description:
        'Delete a note (and its source) by id. A new delete-commit; never rewrites history.',
      shape: deleteInputSchema.omit(omitWorkspace).shape,
      handler: (a) => wrap(() => runDelete(ctx, env, SOURCE, a.id as string, a)),
    },
    {
      name: 'read_note',
      description: 'Read a note by id, optionally including its source node.',
      shape: readInputSchema.omit(omitWorkspace).shape,
      handler: (a) =>
        wrap(() => runReadNote(ctx, env, SOURCE, a.id as string, a.include_source === true)),
    },
    {
      name: 'list_recent',
      description: 'List the most recent notes (newest first) as summaries.',
      shape: listRecentInputSchema.omit(omitWorkspace).shape,
      handler: (a) =>
        wrap(() =>
          runListRecent(ctx, env, SOURCE, {
            ...(typeof a.since === 'string' ? { since: a.since } : {}),
            ...(typeof a.limit === 'number' ? { limit: a.limit } : {}),
          }),
        ),
    },
    {
      name: 'list_tags',
      description: 'List tags across the workspace with counts, optionally filtered by prefix.',
      shape: listTagsInputSchema.omit(omitWorkspace).shape,
      handler: (a) =>
        wrap(() =>
          runListTags(ctx, env, SOURCE, {
            ...(typeof a.prefix === 'string' ? { prefix: a.prefix } : {}),
          }),
        ),
    },
    {
      name: 'init',
      description: 'Scaffold the workspace (notes/ + sources/ + convention marker). Idempotent.',
      shape: {},
      handler: () => wrap(() => runInit(ctx, env, SOURCE)),
    },
  ];
}

/** Run a handler and shape its result; map a throw to an MCP error result. */
async function wrap(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    const e = err as { name?: string; message?: string };
    return {
      content: [
        { type: 'text', text: JSON.stringify({ error: e.name ?? 'Error', message: e.message }) },
      ],
      isError: true,
    };
  }
}
