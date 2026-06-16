// Slug derivation per docs/specs/core-spec.md §1.3.
// Pure function; result is deterministic for the same (title, id) input.

const MAX_SLUG_LENGTH = 60;

export function slugify(input: { title?: string; id: string }): string {
  const title = input.title;
  if (!title || title.trim() === '') return input.id;

  const cleaned = title
    .normalize('NFD') // decompose so combining marks become standalone codepoints
    .replace(/\p{Diacritic}/gu, '') // strip combining marks (é → e, ü → u)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ') // non-letter/number/space/hyphen → space
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (cleaned === '') return input.id;
  return truncateAtWordBoundary(cleaned, MAX_SLUG_LENGTH);
}

function truncateAtWordBoundary(s: string, n: number): string {
  if (s.length <= n) return s;
  const truncated = s.substring(0, n);
  const lastHyphen = truncated.lastIndexOf('-');
  if (lastHyphen > 0) return truncated.substring(0, lastHyphen);
  return truncated; // hard cut when no hyphen exists
}
