// Date helpers for the browse feed (mobile-spec §6) and sync details (§4).
// Pure + bun-testable; all input is ISO-8601 UTC (house standard).
//
// NOTE (follow-up): bucketing is computed in UTC, so "Today/Yesterday" and the
// HH:MM queue rows can be off by a day/hours near local midnight for non-UTC
// users. A local-time pass needs TZ-pinned tests; deferred from v1.0 scaffold.

export type DayBucket = { key: string; label: string };

/** Bucket key (YYYY-MM-DD) + a human label (Today / Yesterday / weekday / date). */
export function dayBucket(iso: string, nowMs: number): DayBucket {
  const key = iso.slice(0, 10);
  const todayKey = new Date(nowMs).toISOString().slice(0, 10);
  const yesterdayKey = new Date(nowMs - 86_400_000).toISOString().slice(0, 10);
  if (key === todayKey) return { key, label: 'Today' };
  if (key === yesterdayKey) return { key, label: 'Yesterday' };
  return { key, label: humanDate(key) };
}

/** Group note-like rows into day buckets, newest first, preserving row order. */
export function groupByDay<T extends { created: string }>(
  rows: ReadonlyArray<T>,
  nowMs: number,
): Array<{ bucket: DayBucket; rows: T[] }> {
  const order: string[] = [];
  const byKey = new Map<string, { bucket: DayBucket; rows: T[] }>();
  for (const row of rows) {
    const bucket = dayBucket(row.created, nowMs);
    let group = byKey.get(bucket.key);
    if (!group) {
      group = { bucket, rows: [] };
      byKey.set(bucket.key, group);
      order.push(bucket.key);
    }
    group.rows.push(row);
  }
  return order.map((k) => byKey.get(k) as { bucket: DayBucket; rows: T[] });
}

/** Coarse relative time for "last sync" / row timestamps. */
export function relativeTime(iso: string, nowMs: number): string {
  const deltaSec = Math.round((nowMs - Date.parse(iso)) / 1000);
  if (deltaSec < 45) return 'just now';
  if (deltaSec < 90) return '1 minute ago';
  if (deltaSec < 3600) return `${Math.round(deltaSec / 60)} minutes ago`;
  if (deltaSec < 7200) return '1 hour ago';
  if (deltaSec < 86_400) return `${Math.round(deltaSec / 3600)} hours ago`;
  if (deltaSec < 172_800) return 'yesterday';
  return `${Math.round(deltaSec / 86_400)} days ago`;
}

/** HH:MM (UTC) for the compact sync-queue rows. */
export function clockTime(iso: string): string {
  return iso.slice(11, 16);
}

function humanDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}
