// Sync store (mobile-spec §3 / §4). Builds the WorkerClient from the active
// endpoint, drives the SyncWorker, and exposes queue depth for the browse-tab
// indicator + sync-details screen. On a synced capture it reconciles the mirror:
// the provisional optimistic note is rebuilt under its real server id.

import { WorkerClient } from '@zonot/core/edge';
import type { CaptureInput } from '@zonot/core/schema';
import { create } from 'zustand';
import { getMirror, getOutbox } from '../db/database.ts';
import { assembleMirrorNote } from '../mirror/capture.ts';
import { SyncWorker } from '../sync/worker.ts';

const FLUSH_GUARD = 50; // bound the drain loop (each tick claims a batch of 10)

interface SyncState {
  pending: number;
  failed: number;
  lastSyncAt: string | null;
  running: boolean;
  /** (Re)bind the worker to an endpoint after connect/hydrate. */
  configure: (endpoint: string) => void;
  /** Drain the outbox now (foreground / connectivity / manual retry). */
  flush: () => Promise<void>;
  /** Recompute queue depth from the outbox (after a local enqueue). */
  refreshCounts: () => void;
}

let worker: SyncWorker | null = null;

export const useSync = create<SyncState>((set, get) => ({
  pending: 0,
  failed: 0,
  lastSyncAt: null,
  running: false,

  configure: (endpoint) => {
    const outbox = getOutbox();
    const mirror = getMirror();
    const client = new WorkerClient({ endpoint });
    worker = new SyncWorker(outbox, client, Date.now, {
      onSynced: (row, result) => {
        if (row.op !== 'capture') return;
        const provisional = mirror.getNote(row.id);
        if (!provisional) return;
        const input = JSON.parse(row.payload_json) as CaptureInput;
        const { note } = assembleMirrorNote(input, {
          id: result.id,
          created: provisional.created,
          source: 'mobile',
          provisional: false,
        });
        // Trust the Worker's committed path (server time may bucket it into a
        // different notes/YYYY/MM/ than the device-derived path). created stays
        // optimistic until a future read-back.
        mirror.put({ ...note, path: result.path });
        if (result.id !== row.id) mirror.remove(row.id);
      },
    });
    get().refreshCounts();
  },

  flush: async () => {
    if (!worker || get().running) return;
    set({ running: true });
    try {
      for (let i = 0; i < FLUSH_GUARD; i++) {
        const r = await worker.tick();
        if (r.synced + r.retried + r.failed === 0) break;
        if (r.synced > 0) set({ lastSyncAt: new Date().toISOString() });
        get().refreshCounts();
      }
    } finally {
      set({ running: false });
      get().refreshCounts();
    }
  },

  refreshCounts: () => {
    const outbox = getOutbox();
    set({ pending: outbox.pendingCount(), failed: outbox.failedCount() });
  },
}));
