import { describe, expect, test } from 'bun:test';
import { deterministicUlid, generateUlid, isValidUlid } from '../ulid.ts';

describe('deterministicUlid', () => {
  test('is stable for the same (time, seed), valid, and time-ordered', () => {
    const a = deterministicUlid(1710000000000, 'notes/inbox.md');
    expect(deterministicUlid(1710000000000, 'notes/inbox.md')).toBe(a); // stable → idempotent reruns
    expect(isValidUlid(a)).toBe(true);
    expect(deterministicUlid(1710000000000, 'other.md')).not.toBe(a); // seed varies the entropy
    // Later time → lexicographically greater (ULIDs sort by time).
    expect(deterministicUlid(1720000000000, 'notes/inbox.md') > a).toBe(true);
  });

  test('distinct seeds at the same millisecond do not collide at scale', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5000; i++) ids.add(deterministicUlid(1710000000000, `notes/file-${i}.md`));
    expect(ids.size).toBe(5000); // ~64-bit entropy → no collisions
  });
});

describe('generateUlid', () => {
  test('returns a 26-char Crockford base32 string', () => {
    const id = generateUlid();
    expect(id).toHaveLength(26);
    expect(isValidUlid(id)).toBe(true);
  });

  test('is monotonically ordered by timestamp', () => {
    const a = generateUlid(1718000000000);
    const b = generateUlid(1718000000001);
    expect(a < b).toBe(true);
  });
});

describe('isValidUlid', () => {
  test('accepts canonical ULIDs', () => {
    expect(isValidUlid('01HZZZA1B2C3D4E5F6G7H8J9K0')).toBe(true);
  });

  test('rejects lowercase, short, or invalid chars', () => {
    expect(isValidUlid('01hzzza1b2c3d4e5f6g7h8j9k0')).toBe(false);
    expect(isValidUlid('01HZZZ')).toBe(false);
    expect(isValidUlid('01HZZZA1B2C3D4E5F6G7H8J9I0')).toBe(false); // 'I' is excluded
    expect(isValidUlid('01HZZZA1B2C3D4E5F6G7H8J9L0')).toBe(false); // 'L' is excluded (Crockford base32 omits I, L, O, U)
    expect(isValidUlid('01HZZZA1B2C3D4E5F6G7H8J9V0')).toBe(true); // 'V' is allowed
  });
});
