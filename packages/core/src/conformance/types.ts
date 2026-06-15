// Conformance fixture types (docs/specs/core-spec.md §4).
// Fixtures are pure data: an input plus the expected pure-function +
// serialization outputs. The harness runs them through three layers and
// reports byte-diffs.

export interface ConformanceCaptureInput {
  workspace?: string;
  thread?: string;
  output: {
    title?: string;
    tags?: ReadonlyArray<string>;
    type?: string;
    body: string;
  };
  raw?: string;
  idempotency_key?: string;
  /** Test-injected ULID for the note. */
  _id: string;
  /** Test-injected current time (ISO-8601 UTC Z). */
  _now: string;
}

export interface ConformanceBodySplit {
  compiled: string;
  timeline: string;
}

export interface ConformanceExpected {
  slug: string;
  path: string;
  /** Serialized frontmatter bytes including the leading/trailing `---`. */
  frontmatter_bytes: string;
  body_split: ConformanceBodySplit;
  /** Optional: normalized tags after passing through normalize-tags. */
  applied_tags?: ReadonlyArray<string>;
}

export interface ConformanceFixture {
  /** Short kebab-case identifier; surfaced on assertion failure. */
  name: string;
  /** One-line note on what this fixture exercises. */
  description?: string;
  input: ConformanceCaptureInput;
  expected: ConformanceExpected;
}

export type ConformanceLayer = 'slug' | 'path' | 'tags' | 'frontmatter' | 'body_split';

export interface ConformanceFailure {
  fixture: string;
  layer: ConformanceLayer;
  expected: string | ReadonlyArray<string>;
  actual: string | ReadonlyArray<string>;
}
