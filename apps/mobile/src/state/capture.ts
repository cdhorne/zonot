// Capture submission (mobile-spec §3.2). Writes the optimistic note to the
// mirror and the pending op to the outbox in one transaction (DURABLE), then the
// caller kicks the sync worker (→ SYNCED in the background). Correction-surface
// ops (append / correct / undo / delete) enqueue the same way.

import type { WriteOp } from '@zonot/core/edge';
import type { CaptureInput } from '@zonot/core/schema';
import { getMirror, getOutbox, transaction } from '../db/database.ts';
import { type LocalCapture, prepareLocalCapture } from '../mirror/capture.ts';

/** Persist a fresh capture (DURABLE). Returns the local capture for the toast. */
export function saveCapture(input: CaptureInput, nowIso = new Date().toISOString()): LocalCapture {
  const local = prepareLocalCapture(input, nowIso);
  transaction(() => {
    getMirror().put(local.note);
    getOutbox().enqueue({
      id: local.provisionalId,
      workspace: input.workspace,
      op: 'capture',
      payload: local.payload,
      idempotencyKey: local.idempotencyKey,
      createdAt: nowIso,
    });
  });
  return local;
}

/** Enqueue a correction-surface op against an existing note (append/correct/undo/delete). */
export function enqueueOp(args: {
  op: Exclude<WriteOp, 'capture'>;
  workspace: string;
  targetId: string;
  payload: unknown;
  idempotencyKey: string;
  nowIso?: string;
}): void {
  const nowIso = args.nowIso ?? new Date().toISOString();
  getOutbox().enqueue({
    id: args.idempotencyKey, // op rows are keyed by their idempotency key
    workspace: args.workspace,
    op: args.op,
    targetId: args.targetId,
    payload: args.payload,
    idempotencyKey: args.idempotencyKey,
    createdAt: nowIso,
  });
}
