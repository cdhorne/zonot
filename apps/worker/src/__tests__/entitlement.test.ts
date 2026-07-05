import { describe, expect, test } from 'bun:test';
import type { KVNamespace } from '@cloudflare/workers-types';
import { NotFoundError } from '@zonot/core/errors';
import {
  EntitlementInactiveError,
  type EntitlementRecord,
  entitlementRecordSchema,
  isEntitled,
  kvEntitlementStore,
} from '../entitlement.ts';
import { dispatchManagedWorkspace } from '../workspace.ts';

const TRACE = '01HZZZA1B2C3D4E5F6G7H8J9K0';

const record = {
  v: 1,
  account_id: 'gh:1234567',
  workspace: 'personal',
  active: true,
  tier: 'c1',
  valid_until: '2026-08-01T00:00:00Z',
  grace_until: null,
  source: 'apple-iap',
  github: { installation_id: 87654321, owner: 'cdhorne', repo: 'zonot-notes' },
} as const;

/** In-memory ENTITLEMENT KV that counts reads and can be mutated or broken. */
function fakeKv(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  const state = { reads: 0, fail: false };
  const kv = {
    async get(key: string, _opts?: unknown) {
      state.reads++;
      if (state.fail) throw new Error('KV unavailable');
      const v = data.get(key);
      return v === undefined ? null : JSON.parse(v);
    },
  } as unknown as KVNamespace;
  return { kv, data, state };
}

describe('entitlementRecordSchema', () => {
  test('accepts the managed-spec §2.1 shape', () => {
    expect(entitlementRecordSchema.safeParse(record).success).toBe(true);
  });

  test('rejects non-UTC timestamps and unknown tiers', () => {
    expect(
      entitlementRecordSchema.safeParse({ ...record, valid_until: '2026-08-01T00:00:00+02:00' })
        .success,
    ).toBe(false);
    expect(entitlementRecordSchema.safeParse({ ...record, tier: 'c2' }).success).toBe(false);
  });

  test('rejects a record without github custody coordinates', () => {
    const { github: _github, ...withoutGithub } = record;
    expect(entitlementRecordSchema.safeParse(withoutGithub).success).toBe(false);
  });
});

describe('isEntitled', () => {
  const parsed = entitlementRecordSchema.parse(record);

  test('active + before valid_until → entitled', () => {
    expect(isEntitled(parsed, new Date('2026-07-15T00:00:00Z'))).toBe(true);
  });

  test('past valid_until with no grace → not entitled', () => {
    expect(isEntitled(parsed, new Date('2026-08-02T00:00:00Z'))).toBe(false);
  });

  test('past valid_until but inside grace → entitled (ADR-0033 lifecycle)', () => {
    const inGrace = { ...parsed, grace_until: '2026-08-17T00:00:00Z' };
    expect(isEntitled(inGrace, new Date('2026-08-10T00:00:00Z'))).toBe(true);
    expect(isEntitled(inGrace, new Date('2026-08-18T00:00:00Z'))).toBe(false);
  });

  test('inactive → never entitled, regardless of dates', () => {
    expect(isEntitled({ ...parsed, active: false }, new Date('2026-07-15T00:00:00Z'))).toBe(false);
  });
});

describe('kvEntitlementStore', () => {
  test('reads entitlement:<workspace> and validates the record', async () => {
    const { kv } = fakeKv({ 'entitlement:personal': record });
    const store = kvEntitlementStore(kv);
    expect((await store.get('personal'))?.account_id).toBe('gh:1234567');
    expect(await store.get('ghost')).toBeNull();
  });

  test('serves from cache inside the 60s window — including cached misses', async () => {
    let clock = 0;
    const { kv, state } = fakeKv({ 'entitlement:personal': record });
    const store = kvEntitlementStore(kv, () => clock);

    await store.get('personal');
    await store.get('ghost');
    clock = 59_999;
    await store.get('personal');
    await store.get('ghost');
    expect(state.reads).toBe(2);
  });

  test('past the window: serves stale immediately, revalidates in background', async () => {
    let clock = 0;
    const { kv, data, state } = fakeKv({ 'entitlement:personal': record });
    const store = kvEntitlementStore(kv, () => clock);

    await store.get('personal');
    data.set(
      'entitlement:personal',
      JSON.stringify({ ...record, active: false } satisfies EntitlementRecord),
    );

    clock = 60_000;
    const stale = await store.get('personal'); // stale served, refresh kicked off
    expect(stale?.active).toBe(true);
    await Bun.sleep(0); // let the background refresh settle
    expect((await store.get('personal'))?.active).toBe(false);
    expect(state.reads).toBe(2);
  });

  test('failed revalidation keeps serving stale and retries later', async () => {
    let clock = 0;
    const { kv, state } = fakeKv({ 'entitlement:personal': record });
    const store = kvEntitlementStore(kv, () => clock);

    await store.get('personal');
    state.fail = true;
    clock = 60_000;
    expect((await store.get('personal'))?.active).toBe(true);
    await Bun.sleep(0);
    // Still stale-served, and the next stale hit retries KV.
    state.fail = false;
    expect((await store.get('personal'))?.active).toBe(true);
    await Bun.sleep(0);
    expect(state.reads).toBe(3);
  });

  test('malformed record → operator error, not a 404', async () => {
    const { kv } = fakeKv({ 'entitlement:personal': { v: 1, nope: true } });
    await expect(kvEntitlementStore(kv).get('personal')).rejects.toThrow(/malformed/);
  });
});

describe('dispatchManagedWorkspace', () => {
  const store = (r: EntitlementRecord | null) => ({ get: () => Promise.resolve(r) });
  const entitled = entitlementRecordSchema.parse(record);
  const NOW = new Date('2026-07-15T00:00:00Z');

  test('entitled → WorkspaceContext with an app credential', async () => {
    const ctx = await dispatchManagedWorkspace('personal', store(entitled), TRACE, NOW);
    expect(ctx.resolution.credential).toEqual({ kind: 'app', installation_id: 87654321 });
    expect(ctx.resolution.owner).toBe('cdhorne');
    expect(ctx.resolution.branch).toBeUndefined();
    expect(ctx.workspace_hash).toMatch(/^sha256:/);
  });

  test('unknown workspace → NotFoundError', async () => {
    await expect(dispatchManagedWorkspace('ghost', store(null), TRACE, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  test('lapsed entitlement → EntitlementInactiveError (403 surface)', async () => {
    const lapsed = { ...entitled, active: false };
    await expect(
      dispatchManagedWorkspace('personal', store(lapsed), TRACE, NOW),
    ).rejects.toBeInstanceOf(EntitlementInactiveError);
  });
});
