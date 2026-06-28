import { ulid as ulidImpl } from 'ulid';

// Generate a fresh ULID (Crockford base32, 26 chars). Time-ordered.
// All ids in Zonot are ULIDs (ADR-0022 toolchain rule; CLAUDE.md house standard).
export function generateUlid(timestamp?: number): string {
  return ulidImpl(timestamp);
}

// Strict ULID format check — used by tests and external integrators.
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;
export function isValidUlid(value: string): boolean {
  return ULID_REGEX.test(value);
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A deterministic ULID: the 48-bit time prefix from `timeMs`, the 80-bit
 * randomness derived from `seed`. Same (timeMs, seed) → same id, so a bulk
 * re-import keyed on (relpath, ctime) doesn't duplicate notes (cli-spec §7.2).
 * Pure JS (no crypto) — stays web-standard; the hash only needs to be
 * deterministic + well-spread, not cryptographically secure.
 */
export function deterministicUlid(timeMs: number, seed: string): string {
  let time = '';
  let t = Math.floor(timeMs);
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  // Two interleaved 32-bit LCGs seeded from both cyrb53 halves (≈64-bit state);
  // emit the mixed HIGH bits — low bits of a power-of-two LCG are low quality.
  let [a, b] = cyrb53(seed);
  let rand = '';
  for (let i = 0; i < 16; i++) {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    b = (Math.imul(b, 22695477) + 1) >>> 0;
    rand += CROCKFORD[((a ^ b) >>> 27) & 31];
  }
  return time + rand;
}

/** cyrb53 — a fast, well-distributed non-cryptographic string hash (both 32-bit halves). */
function cyrb53(str: string): [number, number] {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}
