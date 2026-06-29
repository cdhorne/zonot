// Public surface for @zonot/core/write-client.
// Only the interface is exported here; backends live at their own
// subpaths so consumers pull in only what they ship:
//
//   import type { WriteClient } from '@zonot/core/write-client';
//   import { GitHubRestBackend } from '@zonot/core/write-client/backends/github-rest';
//   import { IsomorphicGitBackend } from '@zonot/core/write-client/backends/isomorphic-git';

export type { WriteClient } from './interface.ts';

// The storage-agnostic op builders (pure; import only `convention`, never a
// backend — so importing them keeps isomorphic-git/GitHub REST out of the
// bundle). The mobile mirror reuses prepareCapture to build a note whose bytes
// are byte-identical to what the Worker will write (one core, one convention).
export type { PreparedCapture, PreparedEdit, PreparedFile } from './shared.ts';
export {
  commitSubject,
  ensureBodyShape,
  ensureTrailingNewline,
  prepareAppend,
  prepareCapture,
  prepareCorrect,
} from './shared.ts';
