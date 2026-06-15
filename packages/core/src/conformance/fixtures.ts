// Starter conformance fixtures. Covers the main rows of the §4.3 matrix:
// slug edge cases, frontmatter key order, YAML quoting, tag normalization,
// body splitter modes, layout derivation, NFC equivalence.
// Add fixtures here as bugs are found or behaviors get pinned.

import type { ConformanceFixture } from './types.ts';

const ID = '01HZZZA1B2C3D4E5F6G7H8J9K0';
const NOW = '2026-06-15T12:00:00Z';

export const STARTER_FIXTURES: ReadonlyArray<ConformanceFixture> = [
  {
    name: 'slug-empty-title-falls-back-to-id',
    description: 'When no title is given, slug equals the note id.',
    input: {
      workspace: 'personal',
      output: { body: 'A note.' },
      _id: ID,
      _now: NOW,
    },
    expected: {
      slug: ID,
      path: `notes/2026/06/${ID}-${ID}.md`,
      frontmatter_bytes: [
        '---',
        `id: ${ID}`,
        'v: 1',
        `created: ${NOW}`,
        'tags: []',
        'workspace: personal',
        '---',
        '',
      ].join('\n'),
      body_split: { compiled: 'A note.', timeline: '' },
      applied_tags: [],
    },
  },
  {
    name: 'slug-basic-ascii-title',
    input: {
      workspace: 'personal',
      output: { title: 'Quick note about launch', body: '' },
      _id: ID,
      _now: NOW,
    },
    expected: {
      slug: 'quick-note-about-launch',
      path: `notes/2026/06/${ID}-quick-note-about-launch.md`,
      frontmatter_bytes: [
        '---',
        `id: ${ID}`,
        'v: 1',
        `created: ${NOW}`,
        'tags: []',
        'title: Quick note about launch',
        'workspace: personal',
        '---',
        '',
      ].join('\n'),
      body_split: { compiled: '', timeline: '' },
      applied_tags: [],
    },
  },
  {
    name: 'slug-strips-diacritics-nfc',
    description: 'NFC normalization + diacritic stripping.',
    input: {
      output: { title: 'Café résumé', body: '' },
      _id: ID,
      _now: NOW,
    },
    expected: {
      slug: 'cafe-resume',
      path: `notes/2026/06/${ID}-cafe-resume.md`,
      frontmatter_bytes: [
        '---',
        `id: ${ID}`,
        'v: 1',
        `created: ${NOW}`,
        'tags: []',
        'title: Café résumé',
        '---',
        '',
      ].join('\n'),
      body_split: { compiled: '', timeline: '' },
      applied_tags: [],
    },
  },
  {
    name: 'tags-normalized-and-deduped',
    input: {
      output: {
        title: 'tags',
        tags: ['Foo Bar', 'foo-bar', ' FOO_BAR '],
        body: '',
      },
      _id: ID,
      _now: NOW,
    },
    expected: {
      slug: 'tags',
      path: `notes/2026/06/${ID}-tags.md`,
      frontmatter_bytes: [
        '---',
        `id: ${ID}`,
        'v: 1',
        `created: ${NOW}`,
        'tags:',
        '  - foo-bar',
        'title: tags',
        '---',
        '',
      ].join('\n'),
      body_split: { compiled: '', timeline: '' },
      applied_tags: ['foo-bar'],
    },
  },
  {
    name: 'frontmatter-key-order',
    description: 'MUST → SHOULD → COULD ordering with all slots populated.',
    input: {
      workspace: 'personal',
      thread: 'q3-launch',
      output: {
        title: 'Full meta',
        tags: ['design'],
        type: 'todo',
        body: '',
      },
      _id: ID,
      _now: NOW,
    },
    expected: {
      slug: 'full-meta',
      path: `notes/2026/06/${ID}-full-meta.md`,
      frontmatter_bytes: [
        '---',
        `id: ${ID}`,
        'v: 1',
        `created: ${NOW}`,
        'tags:',
        '  - design',
        'type: todo',
        'thread: q3-launch',
        'title: Full meta',
        'workspace: personal',
        '---',
        '',
      ].join('\n'),
      body_split: { compiled: '', timeline: '' },
      applied_tags: ['design'],
    },
  },
  {
    name: 'yaml-quoting-colon-in-title',
    input: {
      output: { title: 'foo: bar', body: '' },
      _id: ID,
      _now: NOW,
    },
    expected: {
      slug: 'foo-bar',
      path: `notes/2026/06/${ID}-foo-bar.md`,
      frontmatter_bytes: [
        '---',
        `id: ${ID}`,
        'v: 1',
        `created: ${NOW}`,
        'tags: []',
        "title: 'foo: bar'",
        '---',
        '',
      ].join('\n'),
      body_split: { compiled: '', timeline: '' },
      applied_tags: [],
    },
  },
  {
    name: 'body-splitter-no-divider',
    input: {
      output: { title: 'x', body: 'Just a single line of compiled truth.' },
      _id: ID,
      _now: NOW,
    },
    expected: {
      slug: 'x',
      path: `notes/2026/06/${ID}-x.md`,
      frontmatter_bytes: [
        '---',
        `id: ${ID}`,
        'v: 1',
        `created: ${NOW}`,
        'tags: []',
        'title: x',
        '---',
        '',
      ].join('\n'),
      body_split: {
        compiled: 'Just a single line of compiled truth.',
        timeline: '',
      },
      applied_tags: [],
    },
  },
  {
    name: 'body-splitter-mid-body-divider',
    input: {
      output: {
        title: 'x',
        body: 'Compiled truth\n\n---\n\n- **2026-06-15** | seed',
      },
      _id: ID,
      _now: NOW,
    },
    expected: {
      slug: 'x',
      path: `notes/2026/06/${ID}-x.md`,
      frontmatter_bytes: [
        '---',
        `id: ${ID}`,
        'v: 1',
        `created: ${NOW}`,
        'tags: []',
        'title: x',
        '---',
        '',
      ].join('\n'),
      body_split: {
        compiled: 'Compiled truth\n',
        timeline: '\n- **2026-06-15** | seed',
      },
      applied_tags: [],
    },
  },
  {
    name: 'body-splitter-divider-in-fence-ignored',
    input: {
      output: {
        title: 'x',
        body: 'Top\n```\n---\n```\n---\nBelow',
      },
      _id: ID,
      _now: NOW,
    },
    expected: {
      slug: 'x',
      path: `notes/2026/06/${ID}-x.md`,
      frontmatter_bytes: [
        '---',
        `id: ${ID}`,
        'v: 1',
        `created: ${NOW}`,
        'tags: []',
        'title: x',
        '---',
        '',
      ].join('\n'),
      body_split: {
        compiled: 'Top\n```\n---\n```',
        timeline: 'Below',
      },
      applied_tags: [],
    },
  },
  {
    name: 'layout-uses-utc-year-month',
    description: 'Year/month derive from created (UTC); January gets a leading zero.',
    input: {
      output: { title: 'jan', body: '' },
      _id: ID,
      _now: '2026-01-01T00:00:00Z',
    },
    expected: {
      slug: 'jan',
      path: `notes/2026/01/${ID}-jan.md`,
      frontmatter_bytes: [
        '---',
        `id: ${ID}`,
        'v: 1',
        'created: 2026-01-01T00:00:00Z',
        'tags: []',
        'title: jan',
        '---',
        '',
      ].join('\n'),
      body_split: { compiled: '', timeline: '' },
      applied_tags: [],
    },
  },
];
