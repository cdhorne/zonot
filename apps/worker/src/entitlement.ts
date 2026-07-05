// Entitlement contract (managed-spec §2; ADR-0033). The record is server-
// authoritative operator-side state — derivable, disposable, never in the
// user's repo. Written by the closed control plane's billing adapters; read
// here per request in managed (v1.1) deployments. v1.0 / self-host never
// consults it — the static-map resolver stays the default (managed-spec §3.1).

import type { KVNamespace } from '@cloudflare/workers-types';
import { z } from 'zod';

// ISO-8601 UTC with mandatory 'Z' suffix — same discipline as the convention
// envelope (core frontmatter schema), duplicated here because entitlement is
// operator-side state, not part of the convention kernel (ADR-0031).
const isoUtcSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/,
    'must be ISO-8601 UTC with Z suffix',
  );

/** KV value at `entitlement:<account_id>:<workspace>` (managed-spec §2.1). */
export const entitlementRecordSchema = z.object({
  /** Record version with a forward-migration hook, mirroring ADR-0012. */
  v: z.literal(1),
  /** Zonot account (the OAuth/GitHub identity, ADR-0017) — never a store transaction id. */
  account_id: z.string().min(1),
  workspace: z.string().min(1),
  /** C1 active flag. Flipped only by the writer (final expiry / refund effective time). */
  active: z.boolean(),
  /** "c1" = BYO-model custody; "c1-inference" = the opt-in v1.2 SKU cap (ADR-0033). */
  tier: z.enum(['c1', 'c1-inference']),
  valid_until: isoUtcSchema,
  /** Store/PSP billing-retry grace window end, if in grace (ADR-0033 §Lifecycle). */
  grace_until: isoUtcSchema.nullable(),
  /** Adapter that last wrote this record — audit, never logic. */
  source: z.string().min(1),
  /** GitHub App custody coordinates for per-request token minting (managed-spec §4). */
  github: z.object({
    installation_id: z.number().int().positive(),
    owner: z.string().min(1),
    repo: z.string().min(1),
    branch: z.string().min(1).optional(),
  }),
});

export type EntitlementRecord = z.infer<typeof entitlementRecordSchema>;

/**
 * The reader stays dumb (managed-spec §2.1): entitled means active AND now is
 * before the later of valid_until / grace_until. Lifecycle transitions are the
 * writer's job (closed control plane).
 */
export function isEntitled(record: EntitlementRecord, now: Date): boolean {
  if (!record.active) return false;
  const validUntil = Date.parse(record.valid_until);
  const graceUntil = record.grace_until ? Date.parse(record.grace_until) : Number.NEGATIVE_INFINITY;
  return now.getTime() < Math.max(validUntil, graceUntil);
}

/** Known workspace, entitlement lapsed/revoked → 403 entitlement-inactive
 *  (managed-spec §2.2). Worker-local: entitlement is operator-side state, so
 *  its error is not a core concern (ADR-0031). */
export class EntitlementInactiveError extends Error {
  override readonly name = 'EntitlementInactiveError';
  constructor(public readonly workspace: string) {
    super(`workspace ${workspace} has no active entitlement`);
  }
}

/** A stored record failed validation or contradicts its own key — a
 *  control-plane writer bug, not a caller error → 500 + Sentry. */
export class MalformedEntitlementError extends Error {
  override readonly name = 'MalformedEntitlementError';
  constructor(reason: string) {
    super(`malformed entitlement record: ${reason}`);
  }
}

/** Registers a promise to outlive the response (ExecutionContext.waitUntil).
 *  Without it, workerd may never settle a cross-request refresh. */
export type WaitUntil = (promise: Promise<unknown>) => void;

/**
 * Read side of the entitlement store (managed-spec §2.2). The account id is
 * part of the lookup — a caller can only ever resolve its own workspaces
 * (ADR-0037 §Bright lines). Returns null for unknown pairs (→ 404). The
 * workspace resolver (`dispatchManagedWorkspace`) is the only consumer.
 */
export interface EntitlementStore {
  get(
    accountId: string,
    workspace: string,
    waitUntil?: WaitUntil,
  ): Promise<EntitlementRecord | null>;
}

const SWR_TTL_MS = 60_000;
// Probing unknown workspaces caches misses; cap the map so an attacker can't
// grow isolate memory unboundedly. The cache is disposable — clearing is safe.
const MAX_CACHE_SLOTS = 5_000;

interface CacheSlot {
  record: EntitlementRecord | null; // null = cached miss (unknown workspaces don't hammer KV)
  fetchedAt: number;
  refresh?: Promise<void>; // in-flight revalidation, deduped across requests
}

/**
 * KV-backed store over `entitlement:<account_id>:<workspace>` with a 60s
 * per-isolate stale-while-revalidate cache (worker-spec §4.1): fresh entries
 * are served from memory; stale entries are served immediately while one
 * background refresh runs (pass `waitUntil` so it survives the response); a
 * failed refresh keeps serving stale (stale-while-error) — except a malformed
 * record, which drops the slot so the next read surfaces the operator error
 * instead of hiding it behind stale-forever. Only a cache miss blocks on KV.
 */
export function kvEntitlementStore(
  kv: KVNamespace,
  now: () => number = Date.now,
): EntitlementStore {
  const cache = new Map<string, CacheSlot>();

  async function fetchRecord(key: string): Promise<EntitlementRecord | null> {
    const raw = await kv.get(`entitlement:${key}`, { type: 'json' });
    if (raw === null) return null;
    const parsed = entitlementRecordSchema.safeParse(raw);
    if (!parsed.success) throw new MalformedEntitlementError(parsed.error.message);
    if (`${parsed.data.account_id}:${parsed.data.workspace}` !== key) {
      throw new MalformedEntitlementError('record does not match its key');
    }
    return parsed.data;
  }

  return {
    async get(accountId, workspace, waitUntil) {
      const key = `${accountId}:${workspace}`;
      const slot = cache.get(key);
      if (slot && now() - slot.fetchedAt < SWR_TTL_MS) return slot.record;

      if (slot) {
        // Stale: serve it, revalidate once in the background.
        if (!slot.refresh) {
          slot.refresh = (async () => {
            try {
              const record = await fetchRecord(key);
              cache.set(key, { record, fetchedAt: now() });
            } catch (err) {
              if (err instanceof MalformedEntitlementError) cache.delete(key);
            } finally {
              delete slot.refresh; // re-arm; next stale hit retries
            }
          })();
          waitUntil?.(slot.refresh);
        }
        return slot.record;
      }

      const record = await fetchRecord(key);
      if (cache.size >= MAX_CACHE_SLOTS) cache.clear();
      cache.set(key, { record, fetchedAt: now() });
      return record;
    },
  };
}
