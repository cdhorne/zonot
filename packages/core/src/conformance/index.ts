// Public surface for @zonot/core/conformance.
// Consumed by:
//   - packages/core's own `bun test` suite
//   - apps/mobile's __conformance__ RN JSI harness (Phase 3)
//   - the `zonot doctor` CLI subcommand (Phase 2; self-check)

export { STARTER_FIXTURES } from './fixtures.ts';
export type { ConformanceResult } from './harness.ts';
export { runAllFixtures, runFixture } from './harness.ts';
export type {
  ConformanceBodySplit,
  ConformanceCaptureInput,
  ConformanceExpected,
  ConformanceFailure,
  ConformanceFixture,
  ConformanceLayer,
} from './types.ts';
