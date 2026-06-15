# Mobile app spec — design system, capture surface, sync model, performance budgets

> **Companion to [ADR-0034](../adr/0034-mobile-app-spec.md).** This document is the
> implementation contract for `apps/mobile` (Phase 3). It is **hand-authored**.
> When an ADR and this spec disagree, the ADR wins and this file should be
> fixed. ADR-0034's "Decision" sections summarize; this doc carries the operational detail an
> agent or reviewer needs.

## 0. Scope

What this spec pins:

1. The **design system** — token architecture, semantic vocabulary, the palette contract.
2. The **capture surface** — flow, parser rules, chip strip state, hint line, save discipline.
3. The **sync state model** — durable vs. synced, queue durability, retry policy, failure UX.
4. The **Settings → Sync details** debugging screen.
5. The **performance budgets** + reference devices, with enforcement strategy.

What this spec deliberately does NOT cover (yet — open items in ADR-0034 / future grill cycles):

- The **browse / search** screen layout, faceted scrubber, result rendering, snippet UX.
- The **read view** — markdown renderer choice, wikilink resolution, source-node display.
- The **correction surface UX** — edit / undo / delete gestures and confirmation discipline.
- The **onboarding flow** per audience (BYO-agent dev vs. naive no-agent user).
- The **navigation architecture** detail — Expo Router file layout, deep-link table.
- The **auth / token UX** for v1.0 path-secret and v1.1 OAuth.

Each lands in a future rev of ADR-0034 + a new section here.

## 1. Design system

### 1.1 Lift inventory from Fathom

```
LIFT (drop-in, refactor only for the @design import path):
  apps/mobile/src/design/buildTheme.ts
  apps/mobile/src/design/components.tsx       (Box, Text via createBox/createText)
  apps/mobile/src/design/useFontScale.ts      (MAX_FONT_SCALE cap)
  apps/mobile/src/design/useTabletTextScale.tsx
  apps/mobile/src/design/oklch.ts             (perceptual color math)
  apps/mobile/src/design/contrast.ts          (WCAG contrast checker)
  apps/mobile/src/design/colorblindMatrices.ts (simulation transforms)
  apps/mobile/src/components/Sheet/{Sheet,SheetHeader}.tsx  (3 variants; a11y autofocus)
  apps/mobile/src/utils/logger.ts             (JSONL rotating logger)
  apps/mobile/jest.config.js                  (the transformIgnorePatterns gotcha)
  apps/mobile/plugins/withPnpmPodfileFix.js   (essential for pnpm + iOS pods)

ADAPT (lift the shape, write new content):
  Restyle color tokens — lift the Colors interface shape; rename palette literals from
  Fathom's nautical names ('sonar', 'iso0..2', 'amber', 'isoFg') to neutral semantic role
  names (see §1.3 below). Palette literals carry the brand flavor: deep clear blues and
  teals, bright water (not murky); a single semantic `accent` slot anchored to a cenote-
  water tone (TBD by design pass; placeholder: a teal in the #0e7490–#06b6d4 family);
  neutral surfaces lean bright/airy (off-white canvas, soft-shadow raised). Status colors
  stay conventional (success / warning / danger / info). The semantic token names stay
  neutral (`accent`, `surface`, etc.) per the swappable-palette discipline.

  buildTheme.test.ts — keep the conformance-style mechanism; replace the token enumeration
  with Zonot's semantic vocabulary.

  src/design/fonts.ts + assets/fonts/ — Fathom ships 8 font families; Zonot picks one display
  + one mono (TBD: brand pass). The FONT_ASSETS / useFonts pattern + the PostScript-name-must-
  match gotcha both port directly.

AVOID:
  i18next / react-i18next — defer (v1 en-only).
  encryption-at-rest — Zonot's trust mechanism is observability, not encryption.
  CHART_PALETTE — Zonot has no charts in v1.
```

### 1.2 Token architecture (two-tier, swappable palette)

```
packages/core/src/design/
├── palette/
│   ├── contract.ts          # PaletteContract — every palette must satisfy this
│   ├── zonot.ts             # the shipping default palette (brand-bearing)
│   └── _examples/           # alt palettes for prototyping rebrands
├── semantic.ts              # role tokens reading from palette; light + dark
├── scale.ts                 # spacing, radii, typography, motion, breakpoints, z-index
├── buildTheme.ts            # composes semantic + scale into the Restyle theme
└── __tests__/theme.test.ts  # conformance: every semantic token resolves in both modes
```

**Discipline:**

- Components reference **semantic tokens only** — never `palette.blue.500`, never primitives.
- Light/dark are two resolutions of the same semantic vocabulary, not two component paths.
- Spacing/radii/type-scale follow the same primitive → semantic split.
- Re-branding = swap the palette module; semantic tokens auto-resolve.
- A `theme:check` test on every PR: every semantic key resolves in both modes; no component
  references a primitive (lint rule on `palette/*` imports outside `semantic.ts`).

### 1.3 Semantic token vocabulary

**Colors (18 tokens):**

```ts
surface: {
  canvas    // page bg (deepest)
  raised    // card, sheet
  sunken    // input bg, code fence
  overlay   // modal backdrop
}
text: {
  primary   // main body
  muted     // metadata, timestamps
  subtle    // secondary, placeholder
  inverse   // text on solid-accent bg
  link      // wikilinks, external
}
border: {
  subtle    // dividers, list separators
  default   // input borders, card outlines
  strong    // focused input, selected
}
accent: {
  solid     // primary action bg, selected state
  muted     // hover, low-emphasis accent bg
  text      // accent-colored text
}
status: {
  success   // sync OK, saved
  warning   // queue depth high, stale mirror
  danger    // failed write, delete confirmation
  info      // informational toasts
}
```

**Status tokens are single-color; components compose with `text.inverse` for fg-on-status-bg.**
No bg/fg pair tokens (doubles the count for no expressivity gain).

**Type roles (7 tokens):**

```
display | heading1 | heading2 | body | bodySmall | mono | monoSmall
```

**Spacing primitives:** numeric `space[0..12]` (4px-stepped: 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64).

**Spacing semantic aliases:** `tight | cozy | default | comfy | loose`.

**Radii (5 tokens):** `none | sm | md | lg | full`.

**Motion:**

```
duration: fast (150ms) | default (250ms) | slow (400ms)
easing:   standard | decelerate | accelerate
```

**Elevation (4 tokens):** `shadow: none | subtle | raised | floating`.

**Z-index (6 tokens):** `base | dropdown | sticky | overlay | modal | toast`.

### 1.4 PaletteContract sketch

```ts
export interface PaletteContract {
  brand: {
    primary: string;     // accent.solid resolves here
    primaryMuted: string;// accent.muted resolves here
    text: string;        // accent.text resolves here
  };
  neutral: {
    50:  string;  100: string;  200: string;  300: string;
    400: string;  500: string;  600: string;  700: string;
    800: string;  900: string;  950: string;
  };
  status: {
    success: string;
    warning: string;
    danger:  string;
    info:    string;
  };
  // For each semantic surface/text/border slot, the palette declares
  // its light + dark resolutions (typed via the same interface twice).
}
```

`semantic.ts` constructs the role-token tree by reading from `palette.zonot` (shipping) — or
any palette satisfying the contract.

## 2. Capture surface

### 2.1 Screen layout (textual wireframe)

```
┌─────────────────────────────────────────┐
│  ×              CAPTURE          ⌄ Save │   ← header: cancel + title + save
├─────────────────────────────────────────┤
│                                         │
│  [keyboard-ready text input —           │   ← single text input
│   fills the body of the screen;         │
│   cursor focused on screen open]        │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│ [#design] [@zonot] [!todo]              │   ← chip strip (reactive, when populated)
├─────────────────────────────────────────┤
│ hint: #tag · @thread · !type            │   ← hint line (first-launch; fades)
└─────────────────────────────────────────┘
[keyboard]
```

### 2.2 Parser rules (apply at save AND debounced during typing)

Inline tokens recognized in the body:

- `#tag-slug` — frontmatter `tags[]`. Multiple allowed. Tag-norm runs in core (lowercase,
  hyphenate, dedupe).
- `@thread-slug` — frontmatter `thread`. One allowed; second occurrence wins (last-wins).
- `!type` — frontmatter `type`. Default `note`. Reserved values: `context` is
  source-only; reject in capture with a chip in `danger` state and a hint.

Recognition rules:
- A token must be preceded by start-of-line, whitespace, or `(` — to avoid matching `#1` in
  "Issue #1" or `@user` mid-sentence.
- A token ends at whitespace, end-of-line, `)`, `.`, `,`, `;`, or end of body.
- Inside fenced code blocks (` ``` ` and `~~~`), tokens are **ignored** — code is verbatim.

The parser produces a `ParsedCapture`:

```ts
interface ParsedCapture {
  body: string;          // unchanged from input — LEAVE syntax in body
  tags: string[];        // normalized, deduped
  thread?: string;
  type?: string;         // undefined → 'note' applied by core
  title?: string;        // inferred from first non-empty line (≤80 chars, no period)
                         // or H1; otherwise undefined
  // Chip strip metadata
  chips: ChipSpec[];
}

interface ChipSpec {
  id: string;            // stable across keystrokes for animation reconciliation
  kind: 'tag' | 'thread' | 'type';
  value: string;         // the slug
  sigil: '#' | '@' | '!';
  enabled: boolean;      // default true; tap toggles
  range: [start: number, end: number]; // body offsets where the token lives
}
```

### 2.3 Chip strip behavior

- **Appearance:** chip strip is invisible when `chips.length === 0`. As soon as the parser
  finds a token, the strip slides up from below the input with fade + 150ms decelerate. Toast
  for new chips is one soft pulse (no notification haptic — too noisy for typing).
- **State per chip:**
  - `enabled` (default): solid `accent.muted` bg, `text.primary` text, sigil prefix.
  - `disabled` (tapped off): hollow border `border.subtle`, strikethrough on the value text,
    `text.muted` foreground, sigil remains visible.
- **Toggle behavior:** tap a chip → animate scale 0.95 → 1 (150 ms) + crossfade between
  enabled/disabled palette states. **Body text is not modified by toggling** — only the
  parser's "include in frontmatter" decision flips.
- **Chip removal:** when the user deletes the token from the body, the chip fades out + slides
  down (accelerate, 150 ms). Disabled-state metadata for that token is forgotten.
- **Reordering:** chips render in body-position order (first-seen leftmost). When tokens get
  added or removed, the strip re-orders with a 200 ms position transition.
- **Performance budget:** parser runs in a 250 ms ± 50 ms debounce window post-keystroke. Reflow
  must fit within one frame at 60 fps on iPhone 12 and Pixel 6a.

### 2.4 Hint line

- First-launch (no successful saves yet): always visible above keyboard, `text.subtle`,
  small-mono font, content: `hint: #tag · @thread · !type`.
- After the first successful save: hint fades out (default duration, 250 ms) and never returns
  for that install. Stored in AsyncStorage as `capture.hint_dismissed: true`.
- If the chip strip is visible, the hint hides (chips carry the discoverability load).

### 2.5 Save gestures

| Trigger | Action |
|--------|--------|
| Tap `Save` button (top-right) | Save (no confirmation if body non-empty) |
| Swipe-down on input area | Save and dismiss |
| Hardware `cmd+enter` (iPad kb) | Save |
| Tap `×` button (top-left) | Discard with confirm if body non-empty; bare-tap if empty |
| Background the app | **Do not save.** App returns to current capture screen on foreground. |

**Save is idempotent in the parser sense** — saving the same body twice is fine; the
idempotency_key (auto-generated as a ULID on first save) ensures no duplicate captures.

## 3. Sync state model

### 3.1 Two states, defined

```
DURABLE  Capture is persisted to:
         - local SQLite (op-sqlite) `captures` table (the local mirror)
         - capture queue `outbox` table (pending HTTP-to-Worker)
         If the phone dies right now, the capture survives next launch.

         UI signal:  soft haptic (light) + 1.2s "saved" toast at top.
         Truth-bearing: this is what the user feels as "saved".

SYNCED   The Worker has acked the write (HTTP 200/201 + WriteResult); the commit
         exists on GitHub.

         UI signal:  the queue-depth indicator on the browse tab (no badge at zero;
                     amber dot at depth ≥ 3; in-app notification at any item stuck > 1h).
         Truth-bearing: the file is observable from Obsidian / grep on the desktop.
```

### 3.2 Capture flow (state machine)

```
User taps Save
   ↓
Core normalization (tag-norm, slug-derive, ULID, frontmatter ordering)
   ↓
Insert into local SQLite (captures + outbox) — atomic transaction
   ↓
Show toast + soft haptic ✓ (DURABLE reached, ≤ 80ms iOS / ≤ 200ms Android)
   ↓
Capture screen dismisses; user moves on
   ↓
─ background ─
   ↓
Outbox worker picks the pending capture (next idle / on foreground / on connectivity)
   ↓
HTTP POST to Worker capture endpoint with Idempotency-Key
   ↓
On 2xx: mark outbox row as SYNCED with commit_sha; queue-depth indicator updates
On 4xx (other than 412/422): mark FAILED-PERMANENT; notification surfaces
On 412: refetch SHA, retry (correction path)
On 422 (idempotency replay with different body): mark FAILED-PERMANENT; notification
On 5xx / network: backoff + retry (exp; 1s, 2s, 4s, 8s, 30s, 5m, 30m caps)
```

### 3.3 Outbox table sketch

```sql
CREATE TABLE outbox (
  id              TEXT PRIMARY KEY,    -- ULID; same as capture id
  workspace       TEXT NOT NULL,
  op              TEXT NOT NULL,       -- 'capture' | 'append' | 'correct' | 'undo' | 'delete'
  payload_json    TEXT NOT NULL,       -- the request body
  idempotency_key TEXT NOT NULL,
  created_at      TEXT NOT NULL,       -- ISO-8601
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_attempt_at TEXT NOT NULL,       -- backoff target
  status          TEXT NOT NULL,       -- 'pending' | 'syncing' | 'synced' | 'failed-permanent'
  last_error      TEXT,                -- RFC 9457 Problem Details body (JSON string)
  commit_sha      TEXT                 -- populated on SYNCED
);
CREATE INDEX outbox_status_next ON outbox(status, next_attempt_at);
```

### 3.4 Retry policy

- Backoff schedule: `1s, 2s, 4s, 8s, 30s, 5m, 30m, 30m, 30m, …` (caps at 30m after 7th attempt).
- Triggers for an immediate attempt: foreground transition, network reachability change to
  reachable, manual `Retry queue now` button.
- Maximum lifetime: an item stuck `pending` for > 24h with > 7 attempts surfaces a `failed-
  permanent` notification to ask the user to inspect the sync details screen.

### 3.5 Failure surface budget

```
Queue depth = 0          No visible indicator. (Silent success.)
Queue depth 1–2          No visible indicator. (Quiet retry.)
Queue depth ≥ 3          Amber dot on the browse tab.
Item stuck > 1h          In-app notification (passive; doesn't interrupt capture).
Item failed-permanent    In-app notification with [Retry] [Show details] [Discard].
Token expired (v1.1+)    Critical notification on next foreground; settings deep-link.
```

**Capture screen never blocks for sync state.** Capturing is always available; the queue can
grow indefinitely if needed (the limit is local storage, not policy).

## 4. Settings → Sync details

A dedicated screen accessible from Settings. Layout textual sketch:

```
┌─────────────────────────────────────────┐
│  ←  SYNC DETAILS                        │
├─────────────────────────────────────────┤
│  Workspace:  personal                   │
│  Repo:       cdhorne/zonot-notes        │
│  Last sync:  2 minutes ago              │
│                                         │
│  ── Queue ──────────────                │
│  3 pending  •  0 failed                 │
│  ┌─────────────────────────────────────┐│
│  │ 14:32  capture  attempts: 2  retrying ││
│  │ 14:33  capture  attempts: 1  pending  ││
│  │ 14:35  correct  attempts: 0  pending  ││
│  └─────────────────────────────────────┘│
│  [ Retry queue now ]                    │
│                                         │
│  ── Recent errors ─────                 │
│  13:14  POST capture  502               │
│         GitHub upstream timeout         │
│  09:02  POST capture  401               │
│         Token expired                   │
│                                         │
│  ── Token ─────────                     │
│  Expires: 2026-07-14 (29 days)          │
│  [ Refresh now ]                        │
│                                         │
│  ── Diagnostics ──────                  │
│  [ Show logs ]                          │
│  [ Export diagnostics ]                 │
│                                         │
│  Schema version: 1                      │
│  App version:    0.1.0 (build 4)        │
└─────────────────────────────────────────┘
```

**Discipline:**

- **No PII or note bodies anywhere on this screen.** Only operation type, timestamps,
  HTTP status, RFC 9457 Problem Details (which are operation-level metadata), retry counts.
- **Export diagnostics** bundles everything visible on this screen into a paste-able report
  (JSON or markdown). Useful for filing issues without leaking content.
- **Show logs** opens the JSONL logger output (Fathom-lifted rotating logger, 2 MB cap),
  filtered to the `sync` namespace by default.

## 5. Performance budgets

### 5.1 Budget table

| Operation                                          | iOS daily target | Android floor (Pixel 6a) target |
|----------------------------------------------------|------------------|--------------------------------|
| Cold start → capture screen ready, keyboard up     | ≤ 400 ms         | ≤ 1200 ms                      |
| Cold start → first character typeable              | ≤ 600 ms         | ≤ 1500 ms                      |
| Cold start → browse tab usable (recent + facets)   | ≤ 600 ms         | ≤ 1500 ms                      |
| Keystroke → chip strip update (debounce window)    | 250 ms ± 50 ms   | 250 ms ± 50 ms                 |
| Save tap → durable toast visible                   | ≤ 80 ms          | ≤ 200 ms                       |
| Save tap → Worker ack (good network) p50           | ≤ 1.2 s          | ≤ 2.0 s                        |
| Save tap → Worker ack (good network) p99           | ≤ 3.0 s          | ≤ 5.0 s                        |
| FTS query → first results (10 k-note local mirror) | ≤ 50 ms p99      | ≤ 150 ms p99                   |
| Capture screen idle memory ceiling                 | ≤ 80 MB          | ≤ 60 MB                        |

### 5.2 Reference devices

- **iOS floor:** iPhone 12 / SE 3rd gen (A14/A15 Bionic, iOS 17+).
- **iOS daily measurement:** maker's daily iPhone.
- **Android floor:** Google Pixel 6a (Tensor G1, 6 GB, Android 13+).
- **Constraint:** the maker does not own an Android device; v1.0 Android coverage is
  CI/emulator only.

### 5.3 Enforcement

1. **`perf:check` CI suite** (`apps/mobile/__perf__/`): runs flagged scenarios on every PR
   using Maestro on the iOS sim + an Android emulator. Catches regressions; not precise enough
   for absolute pass/fail.
2. **Manual real-device check** at every milestone exit. The seed's "Exit:" criteria gain a
   perf bullet (`perf budgets met on iOS daily; CI green on Android floor`).
3. **Phase 3 task definitions reference budgets as acceptance criteria.**

### 5.4 Out of scope for v1.0

- iOS Share Sheet handoff latency (v1.1 feature; budget when shipping).
- Initial sync of the local mirror (one-time tarball seed; budget when speccing).
- Background sync window (iOS BGAppRefreshTask is OS-imposed; we work within it).

## 6. Browse / search screen

### 6.1 Layout

```
┌─────────────────────────────────────────┐
│                              ⚙ Settings │   ← gear icon top-right
├─────────────────────────────────────────┤
│ 🔍  Search captures...                  │   ← native UISearchBar
├─────────────────────────────────────────┤
│ [tags ▾] [threads ▾] [type ▾] [when ▾]  │   ← facet scrubber chips
├─────────────────────────────────────────┤
│  Today                                  │
│  ┌─────────────────────────────────────┐│
│  │ Quick note about launch        14:32 ││
│  │ #design @zonot                       ││
│  └─────────────────────────────────────┘│
│  Yesterday                              │
│  Last week                              │
│  ...                                    │
└─────────────────────────────────────────┘
```

### 6.2 Behavior

- **Default (no query, no facets):** chronological feed, most-recent first, grouped by day for
  today/yesterday, then week buckets for older. Pull-to-refresh syncs the local mirror.
- **Search:** tap search bar → search mode, debounced 200 ms, FTS5 `snippet()` highlighting,
  recent-searches cached in AsyncStorage (max 10).
- **Facet chips:** each chip opens a small Sheet (Fathom's `Sheet` primitive, `center` variant)
  listing all corpus values for that facet. Multi-select for tags + types; single-select for
  threads + when. Active chip turns `accent.muted`. Tap again to clear. Sheet has its own
  search-as-you-type input at top (for large vocabularies).
- **Result row:** title (or first body line, 1-line truncate); inline tag chips (max 3 + `+N`);
  right-aligned timestamp. Snippet shown only in search mode.
- **Tap row → read view** (§7).
- **Long-press row → quick-action sheet** (correction surface launch).
- **Settings access:** gear icon top-right; opens Settings → Sync Details / Auth / etc.

### 6.3 Out for v1.0

- Timeline / calendar visual treatment (defer to v1.1 polish).
- Saved aggregations / custom views (deferred per ADR-0008).
- Backlinks panel here (lives in read view, §7).

## 7. Read view

### 7.1 Layout

```
┌─────────────────────────────────────────┐
│ ←   Quick note about launch    ↗   ⋮    │   ← back, title, share, kebab
│ note · 2026-06-14 14:32                 │   ← type · created
│ [#design] [#priority] [@zonot]          │   ← tappable → browse-filter
├─────────────────────────────────────────┤
│ Compiled truth rendered as markdown.    │
│ Inline #tags render as chips.           │
│                                         │
│ ─────────────  timeline  ─────────────  │   ← stylized; replaces raw '---'
│                                         │
│ 2026-06-14 · seed                       │
│   kickoff — initial note                │
│ 2026-06-13 · review                     │
│   points X, Y, Z discussed              │
├─────────────────────────────────────────┤
│ 📎 raw source                           │   ← only if a source pointer exists
│ ▾ Backlinks (3)                         │   ← only if any; expandable
└─────────────────────────────────────────┘
```

### 7.2 Decisions

- **Markdown renderer:** `react-native-marked`.
- **Body split rendered as structured halves.** The compiled half gets full prose formatting
  (headings, code, lists). The timeline half is parsed into dated entries with the date as a
  small column label and body indented. Literal `---` becomes `─── timeline ───` in render. Files
  stay Obsidian-pure; readers get a guided experience.
- **Inline `#tag` / `@thread` / `!type` rendered as tappable chips** (subdued style — smaller,
  `accent.muted` bg) that navigate to browse filtered by that facet.
- **Wikilink resolution (`[[alias]]`)** ships in v1.0. Tap → navigate to the linked note via
  `notes_aliases` lookup. Ambiguous matches → disambiguation Sheet listing candidates.
- **Source node:** if the note has a `source` frontmatter pointer, a `📎 raw source` link at
  the footer opens the source in a `fullscreen` Sheet using the same renderer. Header reads
  `raw source for [note title]`; edit/correct options disabled (sources are immutable from the
  app).
- **Backlinks:** computed at view-open via FTS5 query for `[[<id>]]` OR each alias. Collapsed
  footer section with a count; tap to expand. Best-effort; rare false-positive accepted.
- **Correction launch from read view:** kebab menu top-right (`⋮`). Options: `Edit`,
  `Append timeline entry`, `Undo capture` (if any pending undo target), `Delete`. **All four ops
  are available at any age** per ADR-0026 rev 14 — no time gating; each opens its own
  confirmation modal.
- **View raw markdown toggle:** included in v1.0. A small icon in the header (alongside `↗` and
  `⋮`) flips between rendered and raw modes. Raw mode is **read-only** — it shows the actual
  file bytes (frontmatter + body) in mono. Useful for power users / debugging; cheap to add.
- **Share / copy action (`↗`):** opens an action sheet with three options:
  - **`Copy GitHub URL`** — copies the persistent note URL to clipboard + opens iOS share sheet.
    For private repos: a single confirm dialog warns "this URL requires repo access to view".
  - **`Copy raw markdown`** — copies the verbatim file bytes (frontmatter + body) to clipboard.
  - **`Copy rendered markdown`** — copies the rendered text (frontmatter stripped, timeline
    flattened back to prose) to clipboard. For pasting into chat / email.
  - The selected option becomes the default for the *next* tap (sticky per session).

### 7.3 Out for v1.0

- Inline edit (gated arbitrary-edit path — ADR-0026 explicitly out for v1).
- Image rendering from `sources/` (image-source captures are post-MVP; v1.1+ with share-extension).
- Long-press wikilink peek-preview (post-MVP polish).
- Share-rendered-markdown to other apps as native rich text (v1 keeps it clipboard-only).

## 8. Navigation architecture (Expo Router)

### 8.1 File layout

```
apps/mobile/app/
├── _layout.tsx                      # root: providers (Restyle theme, Zustand hydration,
│                                    #   queryClient, ErrorBoundary, ToastContainer);
│                                    #   auth guard: redirect to /onboarding if no creds
├── index.tsx                        # redirect → /(tabs)/capture
├── (tabs)/
│   ├── _layout.tsx                  # Tabs component; bottom bar (capture | browse)
│   ├── capture.tsx                  # launch tab — capture screen (§2)
│   └── browse.tsx                   # browse / search (§6)
├── note/
│   └── [id].tsx                     # read view (§7) — push onto browse stack on row tap
├── settings/
│   ├── _layout.tsx                  # Settings stack (header: ← Back)
│   ├── index.tsx                    # Settings landing (sections: Auth, Sync, About)
│   ├── auth.tsx                     # token / credentials / sign-out (§9)
│   ├── sync-details.tsx             # the §4 forensic screen
│   └── about.tsx                    # version, license, debug bundle export
├── onboarding/
│   └── index.tsx                    # first-launch screen if no auth configured (§9)
└── +not-found.tsx                   # 404
```

### 8.2 Tabs

- **Two tabs only:** `capture` (launch) + `browse`. The seed's "read" core screen is realized as
  a *route* (`/note/[id]`), not a tab — it lives in the browse stack and on the deep-link table.
- Tab transitions: instant (no animation). Matches Notes / Drafts perceived speed.
- The browse tab's header carries the gear icon → Settings stack.

### 8.3 Deep links

| URL | Lands on |
|-----|----------|
| `zonot://capture` | `/(tabs)/capture` |
| `zonot://capture?body=...&tags=...&thread=...` | capture screen with the body field prefilled |
| `zonot://note/<id>` | `/note/[id]` (read view) |
| `zonot://settings/sync-details` | `/settings/sync-details` |
| `zonot://settings/auth` | `/settings/auth` |

Universal links (`https://zonot.app/...`) follow the same path mapping; configured via Apple
App Site Association + Android `assetlinks.json` (v1.1+ when the domain exists).

### 8.4 Modal sheets

Lift Fathom's `Sheet` primitive (3 variants — `bottom` / `center` / `fullscreen`). Used for:

- **Facet pickers** on browse (`center` variant — list of tag/thread/type values with their
  own search input for large vocabularies).
- **Long-press action sheet** on browse rows (`bottom` variant — edit / append / undo / delete).
- **Share / copy menu** on read view (`bottom` variant — URL / raw / rendered options).
- **Confirm modals** (`center` variant — delete confirm, sign-out confirm).
- **Raw source viewer** from read view (`fullscreen` variant — read-only source rendering).

## 9. Auth & onboarding (v1.0)

### 9.1 v1.0 onboarding screen (`/onboarding`)

```
┌─────────────────────────────────────────┐
│  Welcome to Zonot                       │
│                                         │
│  Connect to your Zonot Worker.          │
│                                         │
│  Worker URL                             │
│  ┌─────────────────────────────────┬───┐│
│  │ https://zonot.example.com/abc123│ 📋││
│  └─────────────────────────────────┴───┘│
│  (Includes the path-secret. Issued by   │
│  the Worker `zonot init` command.)      │
│                                         │
│  Workspace                              │
│  ┌─────────────────────────────────────┐│
│  │ personal                            ││
│  └─────────────────────────────────────┘│
│  (Becomes a dropdown after Test         │
│  connection succeeds.)                  │
│                                         │
│  [ Test connection ]   [ Connect ]      │
└─────────────────────────────────────────┘
```

Behavior:

- Worker URL field has a `Paste from clipboard` button (📋) for speed.
- Workspace field is free text *until* `Test connection` succeeds, then it becomes a dropdown
  populated from `list_workspaces()` (no typo path to non-existent workspaces).
- `Test connection` calls `list_workspaces` against the Worker; on success the workspace
  dropdown populates and the `Connect` button enables. On failure, an inline error shows the
  RFC 9457 detail.
- `Connect` persists the Worker URL to `expo-secure-store` keyed `zonot.worker_url.<workspace>`
  via the Fathom `keyChain.ts` wrapper, then navigates to `/(tabs)/capture`.

### 9.2 Settings → Auth (`/settings/auth`) at v1.0

```
┌─────────────────────────────────────────┐
│  ← AUTHENTICATION                       │
│                                         │
│  Worker:    zonot.example.com           │
│  Workspace: personal                    │
│  Status:    ● connected                 │
│  Last ok:   3 minutes ago               │
│                                         │
│  [ Re-test ]                            │
│                                         │
│  ── Danger ────                         │
│  [ Sign out / Reset ]                   │
└─────────────────────────────────────────┘
```

- **Sign out / Reset** opens a confirm modal with two checkboxes:
  - `Forget credentials` — always checked, can't uncheck.
  - `Wipe local mirror` — optional, off by default (mirror is derivable from the repo, but
    wiping is reasonable for a true reset).
- Confirm → secure-store wipe + (optional) sqlite wipe + return to `/onboarding`.
- **No token expiry surface at v1.0** — path-secrets don't expire; rotation is out-of-band.

### 9.3 Storage

- **`expo-secure-store`** holds the Worker URL (which contains the path-secret).
- **Fathom `keyChain.ts` wrapper** (LIFT per the Fathom inventory) handles versioned keys + the
  "never delete old keys" discipline so a migration to v1.1's OAuth token storage is clean.
- **No PAT on the device at v1.0** — the GitHub PAT lives in the Worker's secret (ADR-0013);
  the client never sees it.

### 9.4 v1.1 onboarding redesign

```
┌─────────────────────────────────────────┐
│  Welcome to Zonot                       │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  ▣  Sign in with GitHub             ││  ← primary CTA (C1 managed)
│  └─────────────────────────────────────┘│
│                                         │
│                                         │
│  Self-hosted? Connect a Worker  →       │  ← secondary plain-text link (C0)
└─────────────────────────────────────────┘
```

**C1 managed flow:**

1. **`Sign in with GitHub`** opens **ASWebAuthenticationSession** (iOS) / **Chrome Custom Tabs**
   (Android). OAuth 2.1 + CIMD per ADR-0017.
2. Universal-link callback (`https://zonot.app/auth/callback`) → token exchange → Zonot account
   established.
3. **GitHub App install:** Zonot directs to the App-install page, scoped to **Contents:rw +
   Metadata:r** on **one repo**. Default: auto-create a repo named **`zonot-notes`**; user can
   pick an existing repo from a list instead.
4. **IAP modal** via StoreKit 2 (iOS) / Play Billing (Android) per ADR-0033. Single SKU; hosted
   inference is the included opt-in cap (off by default).
5. Land in `/(tabs)/capture`.

**C0 self-hosted flow:**

- Unchanged from v1.0 (§9.1). Worker URL + workspace + Test connection.

**Migration from v1.0:**

- On app upgrade, `_layout.tsx` auth guard checks for `zonot.worker_url.*` in secure-store.
- If present → user is treated as already-onboarded C0; `/onboarding` is skipped entirely.
- If a v1.0 user wants to move to C1, they Sign Out (§9.2) explicitly; the next launch lands on
  `/onboarding` and they pick C1 from there. No automated import; rare path.

### 9.5 v1.1 Settings → Auth (extended)

```
┌─────────────────────────────────────────┐
│  ← AUTHENTICATION                       │
│                                         │
│  GitHub:    [avatar] @cdhorne           │
│  Repo:      cdhorne/zonot-notes (private)│
│  App:       Installed                   │
│             [ Manage on GitHub → ]      │
│  Token:     valid · refreshes in 47 min │
│             [ Refresh now ]             │
│  Billing:   Zonot+ · renews 2026-07-14  │
│             [ Manage in App Store → ]   │
│                                         │
│  ── Danger ────                         │
│  [ Sign out / Reset ]                   │
└─────────────────────────────────────────┘
```

- C0 users see the v1.0 rows (Worker / Workspace / Status); C1 users see the rows above.
- **Sign out / Reset for C1** opens a confirm modal with three checkboxes:
  - `Forget credentials` — forced on.
  - `Wipe local mirror` — optional, off by default.
  - `Revoke Zonot's GitHub App access` — optional, off by default; help text: "this stops
    Zonot from writing to your repo even if you sign back in later."

### 9.6 v1.1 token UX

- Refresh proactively ~5 min before expiry on a background timer (or on app foreground if the
  background timer didn't fire).
- On 401 from the Worker: try refresh once; on success retry the original request; on
  refresh-failure → `token-expired` in-app notification → deep-link to `/settings/auth`.
- Token storage: `expo-secure-store` keyed `zonot.oauth.<account_id>` (versioned per Fathom
  `keyChain.ts` discipline).
- Refresh-token rotation per OAuth 2.1 best practice (single-use refresh tokens).

### 9.7 v1.2 hosted-inference consent

**First-trigger modal** (lazy — surfaces the first time an enrichment action would fire):

```
┌─────────────────────────────────────────┐
│  Enrich captures automatically?         │
│                                         │
│  When on, captures are enriched via     │
│  Zonot's hosted inference. The model    │
│  contractually does not train on your   │
│  input. Retention is bounded by the     │
│  provider's data agreement (see About > │
│  Trust for the current ceiling).        │
│                                         │
│  • No training on your captures         │
│  • Up to 200 enrichments per month      │
│  • Past the cap: captures still land,   │
│    just not enriched (Tier 0 raw)       │
│  • Off at any time in Settings          │
│                                         │
│  [ Maybe later ]   [ Turn on ]          │
└─────────────────────────────────────────┘
```

- **Default OFF** per ADR-0027 (operator-read consent required).
- "Maybe later" remembers the answer for the session; re-prompts on next launch.
- "Turn on" enables hosted-inference at the entitlement layer (one-time signal to the Worker).

**Settings → Hosted Inference** (new section under Settings, not under Auth):

```
  ── Hosted Inference ──
  Status:    ● enabled
  Used:      12 / 200 this month
  Model:     Workers AI · llama-3.3-70b-instruct
  Resets:    2026-07-01

  [ Disable ]
  [ What counts as enrichment? → ]
```

- Toggle disable/enable persists immediately.
- Usage meter refreshes on app foreground (cached in `entitlements.json` from the server).
- Cap-exceeded UX: silent fallback to Tier 0 raw capture (no modal, no error). Notification
  fires once per cap-cycle with `[Manage usage →]` CTA deep-linking to this screen.
- Approaching-cap (≥80%): passive in-app notification with the same CTA.

## 10. Open items (for next grill cycle)

These are the items ADR-0034 names as `Open`; they fold into rev bumps as resolved:

- **Tag autocomplete from existing corpus.** Defer until chip-strip telemetry signals demand.
- **Source `raw` field policy for mobile.** When does in-app capture write a `sources/` node?
  (Phase 0 spec §5 open item — applies to mobile too.)
