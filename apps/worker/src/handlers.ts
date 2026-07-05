// The one handler set (ADR-0022). Both transports — the HTTP router and the MCP
// tool surface — call these; nothing op-specific lives in either adapter. Each
// handler builds the per-request backend, enforces the rate limit, validates
// input against the shared core schema, and (for writes) applies idempotency.

import { ValidationError } from '@zonot/core/errors';
import {
  type AppendInput,
  appendInputSchema,
  type CaptureInput,
  type CorrectInput,
  captureInputSchema,
  correctInputSchema,
  type DeleteInput,
  deleteInputSchema,
  type InitInput,
  type InitResult,
  initInputSchema,
  type ListRecentInput,
  type ListTagsInput,
  listRecentInputSchema,
  listTagsInputSchema,
  type NoteRecord,
  type NoteSummary,
  type ReadInput,
  readInputSchema,
  type TagSummary,
  type UndoInput,
  undoInputSchema,
  type WriteResult,
} from '@zonot/core/schema';
import { GitHubRestBackend } from '@zonot/core/write-client/backends/github-rest';
import type { z } from 'zod';
import type { Env, WorkspaceContext } from './env.ts';
import { getGitHubToken } from './github-token.ts';
import { kvIdempotencyStore, withIdempotency } from './idempotency.ts';
import { enforceRateLimit } from './ratelimit.ts';

/** Build the GitHub adapter for this request. `source` becomes the provenance
 *  trailer. Async because App credentials mint their token here (github-token.ts). */
export async function createBackend(
  ctx: WorkspaceContext,
  env: Env,
  source: string,
): Promise<GitHubRestBackend> {
  return new GitHubRestBackend({
    owner: ctx.resolution.owner,
    repo: ctx.resolution.repo,
    token: await getGitHubToken(ctx, env),
    source,
    ...(ctx.resolution.branch ? { branch: ctx.resolution.branch } : {}),
  });
}

/** Validate against a core schema, raising the wire-mapped ValidationError on failure. */
export function validate<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message })),
    );
  }
  return result.data;
}

function idemStore(env: Env) {
  return env.IDEMPOTENCY ? kvIdempotencyStore(env.IDEMPOTENCY) : null;
}

// --- writes ----------------------------------------------------------------

export async function runCapture(
  ctx: WorkspaceContext,
  env: Env,
  source: string,
  body: unknown,
  idemKey: string | undefined,
): Promise<WriteResult> {
  const input: CaptureInput = validate(captureInputSchema, {
    ...(body as object),
    workspace: ctx.workspace,
  });
  await enforceRateLimit(env, ctx.workspace_hash, 'capture');
  const backend = await createBackend(ctx, env, source);
  return withIdempotency(idemStore(env), ctx.workspace, idemKey, input, () =>
    backend.capture(input),
  );
}

export async function runAppend(
  ctx: WorkspaceContext,
  env: Env,
  source: string,
  id: string,
  body: unknown,
  idemKey: string | undefined,
): Promise<WriteResult> {
  const input: AppendInput = validate(appendInputSchema, {
    ...(body as object),
    workspace: ctx.workspace,
    id,
  });
  await enforceRateLimit(env, ctx.workspace_hash, 'append');
  const backend = await createBackend(ctx, env, source);
  return withIdempotency(idemStore(env), ctx.workspace, idemKey, input, () =>
    backend.append(input),
  );
}

export async function runCorrect(
  ctx: WorkspaceContext,
  env: Env,
  source: string,
  id: string,
  body: unknown,
  idemKey: string | undefined,
): Promise<WriteResult> {
  const input: CorrectInput = validate(correctInputSchema, {
    ...(body as object),
    workspace: ctx.workspace,
    id,
  });
  await enforceRateLimit(env, ctx.workspace_hash, 'correct');
  const backend = await createBackend(ctx, env, source);
  return withIdempotency(idemStore(env), ctx.workspace, idemKey, input, () =>
    backend.correct(input),
  );
}

export async function runUndo(
  ctx: WorkspaceContext,
  env: Env,
  source: string,
  captureId: string,
  body: unknown,
): Promise<WriteResult> {
  const input: UndoInput = validate(undoInputSchema, {
    ...(body as object),
    workspace: ctx.workspace,
    capture_id: captureId,
  });
  await enforceRateLimit(env, ctx.workspace_hash, 'undo');
  return (await createBackend(ctx, env, source)).undo(input);
}

export async function runDelete(
  ctx: WorkspaceContext,
  env: Env,
  source: string,
  id: string,
  body: unknown,
): Promise<WriteResult> {
  const input: DeleteInput = validate(deleteInputSchema, {
    ...(body as object),
    workspace: ctx.workspace,
    id,
  });
  await enforceRateLimit(env, ctx.workspace_hash, 'delete');
  return (await createBackend(ctx, env, source)).delete(input);
}

export async function runInit(
  ctx: WorkspaceContext,
  env: Env,
  source: string,
): Promise<InitResult> {
  const input: InitInput = validate(initInputSchema, {
    workspace: ctx.workspace,
    conventionVersion: 1,
  });
  await enforceRateLimit(env, ctx.workspace_hash, 'init');
  return (await createBackend(ctx, env, source)).init(input);
}

// --- reads -----------------------------------------------------------------

export async function runReadNote(
  ctx: WorkspaceContext,
  env: Env,
  source: string,
  id: string,
  includeSource: boolean,
): Promise<NoteRecord> {
  const input: ReadInput = validate(readInputSchema, {
    workspace: ctx.workspace,
    id,
    include_source: includeSource,
  });
  await enforceRateLimit(env, ctx.workspace_hash, 'read');
  return (await createBackend(ctx, env, source)).readNote(input);
}

export async function runListRecent(
  ctx: WorkspaceContext,
  env: Env,
  source: string,
  query: { since?: string; limit?: number },
): Promise<NoteSummary[]> {
  const input: ListRecentInput = validate(listRecentInputSchema, {
    ...query,
    workspace: ctx.workspace,
  });
  await enforceRateLimit(env, ctx.workspace_hash, 'list');
  return (await createBackend(ctx, env, source)).listRecent(input);
}

export async function runListTags(
  ctx: WorkspaceContext,
  env: Env,
  source: string,
  query: { prefix?: string },
): Promise<TagSummary[]> {
  const input: ListTagsInput = validate(listTagsInputSchema, {
    ...query,
    workspace: ctx.workspace,
  });
  await enforceRateLimit(env, ctx.workspace_hash, 'tags');
  return (await createBackend(ctx, env, source)).listTags(input);
}
