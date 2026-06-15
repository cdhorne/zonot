// Conformance harness: runs a fixture through the pure-function +
// serialization layers and returns a list of failures (empty = green).
// The same harness runs in Bun (CLI / Worker dev) and inside the RN JSI
// runtime (apps/mobile/__conformance__/) to prove byte-identical output.

import { splitBody } from '../convention/body.ts';
import { buildNoteFrontmatter } from '../convention/build-frontmatter.ts';
import { serializeNoteFrontmatter } from '../convention/frontmatter-serialize.ts';
import { deriveNotePath } from '../convention/layout.ts';
import { normalizeTags } from '../convention/normalize-tags.ts';
import { slugify } from '../convention/slug.ts';
import type { ConformanceFailure, ConformanceFixture } from './types.ts';

export interface ConformanceResult {
  fixture: string;
  passed: boolean;
  failures: ConformanceFailure[];
}

export function runFixture(fixture: ConformanceFixture): ConformanceResult {
  const failures: ConformanceFailure[] = [];
  const { input, expected, name } = fixture;

  // Layer 1: pure functions.
  const computedSlug = slugify({
    id: input._id,
    ...(input.output.title !== undefined ? { title: input.output.title } : {}),
  });
  if (computedSlug !== expected.slug) {
    failures.push({
      fixture: name,
      layer: 'slug',
      expected: expected.slug,
      actual: computedSlug,
    });
  }

  const computedPath = deriveNotePath({
    id: input._id,
    slug: computedSlug,
    created: input._now,
  });
  if (computedPath !== expected.path) {
    failures.push({
      fixture: name,
      layer: 'path',
      expected: expected.path,
      actual: computedPath,
    });
  }

  const computedTags = normalizeTags(input.output.tags ?? []);
  if (expected.applied_tags !== undefined) {
    const expectedTags = expected.applied_tags;
    if (!arrayEquals(computedTags, expectedTags)) {
      failures.push({
        fixture: name,
        layer: 'tags',
        expected: expectedTags,
        actual: computedTags,
      });
    }
  }

  // Layer 2: serialization (byte-identical frontmatter).
  const frontmatter = buildNoteFrontmatter({
    id: input._id,
    created: input._now,
    ...(input.workspace !== undefined ? { workspace: input.workspace } : {}),
    ...(input.thread !== undefined ? { thread: input.thread } : {}),
    output: {
      ...(input.output.title !== undefined ? { title: input.output.title } : {}),
      ...(input.output.tags !== undefined ? { tags: input.output.tags } : {}),
      ...(input.output.type !== undefined ? { type: input.output.type } : {}),
    },
  });
  const serialized = serializeNoteFrontmatter(
    frontmatter as Record<string, unknown> as Record<string, never>,
  );
  if (serialized !== expected.frontmatter_bytes) {
    failures.push({
      fixture: name,
      layer: 'frontmatter',
      expected: expected.frontmatter_bytes,
      actual: serialized,
    });
  }

  // Layer 2b: body splitter.
  const split = splitBody(input.output.body);
  if (
    split.compiled !== expected.body_split.compiled ||
    split.timeline !== expected.body_split.timeline
  ) {
    failures.push({
      fixture: name,
      layer: 'body_split',
      expected: JSON.stringify(expected.body_split),
      actual: JSON.stringify(split),
    });
  }

  return {
    fixture: name,
    passed: failures.length === 0,
    failures,
  };
}

export function runAllFixtures(fixtures: ReadonlyArray<ConformanceFixture>): ConformanceResult[] {
  return fixtures.map((f) => runFixture(f));
}

function arrayEquals(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
