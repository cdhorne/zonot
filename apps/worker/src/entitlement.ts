// Entitlement contract (managed-spec §2; ADR-0033). The record is server-
// authoritative operator-side state — derivable, disposable, never in the
// user's repo. Written by the closed control plane's billing adapters; read
// here per request in managed (v1.1) deployments. v1.0 / self-host never
// consults it — the static-map resolver stays the default (managed-spec §3.1).

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

/** KV value at `entitlement:<workspace>` (managed-spec §2.1). */
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

/**
 * Read side of the entitlement store (managed-spec §2.2). The v1.1 KV-backed
 * implementation (60s stale-while-revalidate over `entitlement:<workspace>`)
 * lands with task 4(a); this interface is the seam the workspace resolver
 * swaps onto. Returns null for unknown workspaces (→ 404, same timing
 * discipline as the v1.0 dispatch).
 */
export interface EntitlementStore {
  get(workspace: string): Promise<EntitlementRecord | null>;
}
