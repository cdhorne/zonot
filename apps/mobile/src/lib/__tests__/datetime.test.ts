import { describe, expect, test } from 'bun:test';
import { clockTime, dayBucket, groupByDay, relativeTime } from '../datetime.ts';

const NOW = Date.parse('2026-06-14T12:00:00.000Z');

describe('dayBucket', () => {
  test('labels today / yesterday / older', () => {
    expect(dayBucket('2026-06-14T08:00:00.000Z', NOW).label).toBe('Today');
    expect(dayBucket('2026-06-13T23:00:00.000Z', NOW).label).toBe('Yesterday');
    expect(dayBucket('2026-06-10T09:00:00.000Z', NOW).label).toBe('Jun 10, 2026');
  });
});

describe('groupByDay', () => {
  test('groups newest-first, preserving row order within a day', () => {
    const rows = [
      { id: 'a', created: '2026-06-14T11:00:00.000Z' },
      { id: 'b', created: '2026-06-14T09:00:00.000Z' },
      { id: 'c', created: '2026-06-13T20:00:00.000Z' },
    ];
    const groups = groupByDay(rows, NOW);
    expect(groups.map((g) => g.bucket.label)).toEqual(['Today', 'Yesterday']);
    expect(groups[0]?.rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(groups[1]?.rows.map((r) => r.id)).toEqual(['c']);
  });
});

describe('relativeTime', () => {
  test('coarse buckets', () => {
    expect(relativeTime('2026-06-14T11:58:00.000Z', NOW)).toBe('2 minutes ago');
    expect(relativeTime('2026-06-14T11:59:50.000Z', NOW)).toBe('just now');
    expect(relativeTime('2026-06-14T10:00:00.000Z', NOW)).toBe('2 hours ago');
  });
});

test('clockTime is HH:MM', () => {
  expect(clockTime('2026-06-14T14:32:07.000Z')).toBe('14:32');
});
