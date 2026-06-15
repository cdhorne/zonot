import { describe, expect, test } from 'bun:test';
import { runAllFixtures, runFixture, STARTER_FIXTURES } from '../index.ts';

describe('Conformance harness', () => {
  test('every starter fixture passes all three layers', () => {
    const results = runAllFixtures(STARTER_FIXTURES);
    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
      const report = failed
        .map((r) =>
          [
            `\n  fixture: ${r.fixture}`,
            ...r.failures.map(
              (f) =>
                `    [${f.layer}]\n      expected: ${JSON.stringify(f.expected)}\n      actual:   ${JSON.stringify(f.actual)}`,
            ),
          ].join('\n'),
        )
        .join('\n');
      throw new Error(`conformance failures:${report}`);
    }
    expect(failed).toHaveLength(0);
  });

  test('every fixture has a unique name', () => {
    const names = STARTER_FIXTURES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('runFixture returns failures for an intentionally-bad fixture', () => {
    const first = STARTER_FIXTURES[0];
    if (!first) throw new Error('STARTER_FIXTURES is empty');
    const bad = {
      ...first,
      expected: {
        ...first.expected,
        slug: 'this-is-wrong-on-purpose',
      },
    };
    const result = runFixture(bad);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.layer === 'slug')).toBe(true);
  });
});
