import { describe, expect, test } from 'bun:test';
import type { KVNamespace } from '@cloudflare/workers-types';
import { NotFoundError } from '@zonot/core/errors';
import {
  EntitlementInactiveError,
  type EntitlementRecord,
  entitlementRecordSchema,
  isEntitled,
  kvEntitlementStore,
  MalformedEntitlementError,
} from '../entitlement.ts';
import { dispatchManagedWorkspace } from '../workspace.ts';

const TRACE = '01HZZZA1B2C3D4E5F6G7H8J9K0';
const ACCOUNT = 'gh:1234567';
const KEY = `entitlement:${ACCOUNT}:personal`;

const record = {
  v: 1,
  account_id: ACCOUNT,
  workspace: 'personal',
  active: true,
  tier: 'c1',
  valid_until: '2026-08-01T00:00:00Z',
  grace_until: null,
  source: 'apple-iap',
  github: { installation_id: 87654321, owner: 'cdhorne', repo: 'zonot-notes' },
} as const;

/** In-memory ENTITLEMENT KV that honors { type: 'json' }, counts reads, and
 *  can be made slow or broken. */
function fakeKv(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  const state = { reads: 0, fail: false, gate: null as Promise<void> | null };
  const kv = {
    async get(key: string, opts?: { type?: string }) {
      state.reads++;
      if (state.gate) await state.gate;
      if (state.fail) throw new Error('KV unavailable');
      const v = data.get(key);
      if (v === undefined) return null;
      return opts?.type === 'json' ? JSON.parse(v) : v;
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
  test('reads entitlement:<account>:<workspace> and validates the record', async () => {
    const { kv } = fakeKv({ [KEY]: record });
    const store = kvEntitlementStore(kv);
    expect((await store.get(ACCOUNT, 'personal'))?.github.installation_id).toBe(87654321);
    expect(await store.get(ACCOUNT, 'ghost')).toBeNull();
  });

  test('lookups are account-scoped — another account cannot see the workspace', async () => {
    const { kv } = fakeKv({ [KEY]: record });
    expect(await kvEntitlementStore(kv).get('gh:9999999', 'personal')).toBeNull();
  });

  test('a record contradicting its own key → MalformedEntitlementError', async () => {
    const { kv } = fakeKv({ [KEY]: { ...record, account_id: 'gh:9999999' } });
    await expect(kvEntitlementStore(kv).get(ACCOUNT, 'personal')).rejects.toBeInstanceOf(
      MalformedEntitlementError,
    );
  });

  test('serves from cache inside the 60s window — including cached misses', async () => {
    let clock = 0;
    const { kv, state } = fakeKv({ [KEY]: record });
    const store = kvEntitlementStore(kv, () => clock);

    await store.get(ACCOUNT, 'personal');
    await store.get(ACCOUNT, 'ghost');
    clock = 59_999;
    await store.get(ACCOUNT, 'personal');
    await store.get(ACCOUNT, 'ghost');
    expect(state.reads).toBe(2);
  });

  test('past the window: serves stale immediately, revalidates in background', async () => {
    let clock = 0;
    const { kv, data, state } = fakeKv({ [KEY]: record });
    const store = kvEntitlementStore(kv, () => clock);

    await store.get(ACCOUNT, 'personal');
    data.set(KEY, JSON.stringify({ ...record, active: false } satisfies EntitlementRecord));

    clock = 60_000;
    const stale = await store.get(ACCOUNT, 'personal'); // stale served, refresh kicked off
    expect(stale?.active).toBe(true);
    await Bun.sleep(0); // let the background refresh settle
    expect((await store.get(ACCOUNT, 'personal'))?.active).toBe(false);
    expect(state.reads).toBe(2);
  });

  test('concurrent stale reads share one refresh, all registered via waitUntil', async () => {
    let clock = 0;
    let open = () => {};
    const { kv, state } = fakeKv({ [KEY]: record });
    const store = kvEntitlementStore(kv, () => clock);
    const waited: Promise<unknown>[] = [];

    await store.get(ACCOUNT, 'personal');
    state.gate = new Promise((resolve) => {
      open = resolve as () => void;
    });
    clock = 60_000;
    await store.get(ACCOUNT, 'personal', (p) => waited.push(p));
    await store.get(ACCOUNT, 'personal', (p) => waited.push(p));
    open();
    await Promise.all(waited);
    expect(waited.length).toBe(1); // second stale read piggybacked on the first refresh
    expect(state.reads).toBe(2);
  });

  test('failed revalidation keeps serving stale and retries later', async () => {
    let clock = 0;
    const { kv, state } = fakeKv({ [KEY]: record });
    const store = kvEntitlementStore(kv, () => clock);

    await store.get(ACCOUNT, 'personal');
    state.fail = true;
    clock = 60_000;
    expect((await store.get(ACCOUNT, 'personal'))?.active).toBe(true);
    await Bun.sleep(0);
    // Still stale-served, and the next stale hit retries KV.
    state.fail = false;
    expect((await store.get(ACCOUNT, 'personal'))?.active).toBe(true);
    await Bun.sleep(0);
    expect(state.reads).toBe(3);
  });

  test('a record that goes malformed surfaces on the next read, not stale-forever', async () => {
    let clock = 0;
    const { kv, data } = fakeKv({ [KEY]: record });
    const store = kvEntitlementStore(kv, () => clock);

    await store.get(ACCOUNT, 'personal');
    data.set(KEY, JSON.stringify({ v: 1, nope: true }));
    clock = 60_000;
    await store.get(ACCOUNT, 'personal'); // stale served; refresh finds corruption, drops slot
    await Bun.sleep(0);
    await expect(store.get(ACCOUNT, 'personal')).rejects.toBeInstanceOf(MalformedEntitlementError);
  });

  test('malformed record on a cold read → operator error, not a 404', async () => {
    const { kv } = fakeKv({ [KEY]: { v: 1, nope: true } });
    await expect(kvEntitlementStore(kv).get(ACCOUNT, 'personal')).rejects.toBeInstanceOf(
      MalformedEntitlementError,
    );
  });
});

describe('dispatchManagedWorkspace', () => {
  const store = (r: EntitlementRecord | null) => ({
    get: (_account: string, _ws: string) => Promise.resolve(r),
  });
  const entitled = entitlementRecordSchema.parse(record);
  const NOW = new Date('2026-07-15T00:00:00Z');

  test('entitled → WorkspaceContext with an app credential', async () => {
    const ctx = await dispatchManagedWorkspace(ACCOUNT, 'personal', store(entitled), TRACE, {
      now: NOW,
    });
    expect(ctx.resolution.credential).toEqual({ kind: 'app', installation_id: 87654321 });
    expect(ctx.resolution.owner).toBe('cdhorne');
    expect(ctx.resolution.branch).toBeUndefined();
    expect(ctx.workspace_hash).toMatch(/^sha256:/);
  });

  test('unknown account/workspace pair → NotFoundError', async () => {
    await expect(
      dispatchManagedWorkspace(ACCOUNT, 'ghost', store(null), TRACE, { now: NOW }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('lapsed entitlement → EntitlementInactiveError (403 surface)', async () => {
    const lapsed = { ...entitled, active: false };
    await expect(
      dispatchManagedWorkspace(ACCOUNT, 'personal', store(lapsed), TRACE, { now: NOW }),
    ).rejects.toBeInstanceOf(EntitlementInactiveError);
  });
});
