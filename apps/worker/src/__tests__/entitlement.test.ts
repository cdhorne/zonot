import { describe, expect, test } from 'bun:test';
import { entitlementRecordSchema, isEntitled } from '../entitlement.ts';
import type { WorkspaceContext } from '../env.ts';
import { staticPatTokenProvider } from '../github-token.ts';

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

describe('staticPatTokenProvider', () => {
  test('yields the static-map PAT (the v1.0 half of the managed-spec §4 seam)', async () => {
    const ctx: WorkspaceContext = {
      workspace: 'personal',
      workspace_hash: 'sha256:abc',
      resolution: { owner: 'cdhorne', repo: 'zonot-notes', token: 'ghp_x', path_secret: 's' },
      trace_id: '01HZZZA1B2C3D4E5F6G7H8J9K0',
    };
    expect(await staticPatTokenProvider.getToken(ctx)).toBe('ghp_x');
  });
});
