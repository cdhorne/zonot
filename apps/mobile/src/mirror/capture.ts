// Capture bridge — turns a CaptureInput into (a) the optimistic note for the
// local mirror and (b) the payload to enqueue for the Worker. It reuses the
// core prepareCapture so the bytes the device shows are byte-identical to what
// the Worker will commit (mobile-spec §3.2 / one core, one convention).
//
// The note id is server-generated (the capture endpoint mints the ULID), so the
// device shows a *provisional* note under a locally-minted id; on ack the sync
// layer rebuilds the note under the real id (assembleMirrorNote with
// provisional:false) and drops the provisional row.

import { generateUlid } from '@zonot/core';
import type { CaptureInput } from '@zonot/core/schema';
import { prepareCapture } from '@zonot/core/write-client';
import type { MirrorNote } from './mirror.ts';

export interface AssembleDeps {
  id: string;
  created: string; // ISO-8601 UTC
  /** Provenance source label written to the source node's trailer (e.g. 'mobile'). */
  source: string;
  provisional: boolean;
  newSourceId?: (() => string) | undefined;
}

/** Build the convention-correct note (and applied tags) for a capture. */
export function assembleMirrorNote(
  input: CaptureInput,
  deps: AssembleDeps,
): { note: MirrorNote; appliedTags: string[] } {
  const prepared = prepareCapture(input, {
    id: deps.id,
    created: deps.created,
    source: deps.source,
    newSourceId: deps.newSourceId ?? generateUlid,
  });
  return {
    note: {
      id: deps.id,
      path: prepared.note.path,
      content: prepared.note.content,
      workspace: input.workspace,
      created: deps.created,
      provisional: deps.provisional,
    },
    appliedTags: prepared.applied_tags,
  };
}

export interface LocalCapture {
  /** Optimistic note for the mirror (provisional: true). */
  note: MirrorNote;
  /** Request body to enqueue for the Worker, carrying the idempotency key. */
  payload: CaptureInput;
  provisionalId: string;
  idempotencyKey: string;
  appliedTags: string[];
}

/**
 * Prepare a fresh on-device capture: mint the provisional id + idempotency key,
 * assemble the optimistic note, and return the Worker payload. The caller writes
 * `note` to the mirror and `payload` to the outbox in one transaction (§3.2).
 */
export function prepareLocalCapture(
  input: CaptureInput,
  now: string,
  ids: { newId?: () => string } = {},
): LocalCapture {
  const mint = ids.newId ?? generateUlid;
  const provisionalId = mint();
  const idempotencyKey = input.idempotency_key ?? mint();
  const { note, appliedTags } = assembleMirrorNote(input, {
    id: provisionalId,
    created: now,
    source: 'mobile',
    provisional: true,
    newSourceId: mint,
  });
  return {
    note,
    payload: { ...input, idempotency_key: idempotencyKey },
    provisionalId,
    idempotencyKey,
    appliedTags,
  };
}
