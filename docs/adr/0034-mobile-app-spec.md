---
adr: 0034
title: Mobile app specification
status: Accepted (rev 6)
slug: mobile-app-spec
tags: [app, ux, perf, design, scope]
---

# ADR-0034. Mobile app specification

## Context

ADR-0010 names the mobile app as the wedge and ADR-0025 makes it the dual-audience stress test, but the design surface was deferred. A 2026-06-14 grilling cycle closed the load-bearing cluster. Companion spec: **[`docs/specs/mobile-spec.md`](../specs/mobile-spec.md)**.

## Decision

### Design system

Lift Fathom's Restyle scaffolding (`buildTheme`, `components`, `useFontScale`, `useTabletTextScale`, the `Sheet` primitive) verbatim; recolor the palette (Fathom's nautical names violate the no-theming rule). **Two-tier token architecture** with a swappable palette: primitive `palette/zonot.ts` behind a `PaletteContract`; semantic role tokens (`accent`, `surface`, `text.*`, `border.*`, `status.*`) read from the palette. Components reference **semantic tokens only**. Light/dark are two resolutions of the same vocabulary. A conformance-style test asserts every semantic token resolves in both modes. No third "component token" tier in v1.

### Capture surface (the wedge's wedge)

**Launch tab = capture**, keyboard-up, cursor in a single full-screen text input. **Single-input parse-on-save** (Drafts/Bear pattern) with inline syntax — `#tag` (Obsidian-native), `@thread-slug`, `!type` (or trailing). **LEAVE syntax in body verbatim** (Obsidian inline-tag compatibility — ADR-0005 wins over a cleaner body). A **reactive debounced (250 ms) chip strip** above the keyboard renders parsed tokens; tap-to-toggle disables a chip → parsed-but-excluded from frontmatter (text stays in body). One-line hint (`hint: #tag · @thread · !type`) for first-launch; fades after first save. Soft-pop animation (fade + 150 ms slide-up, decelerate). No structured-mode toggle, no review sheet — the chip strip carries discoverability.

### Capture entry points (sequenced)

- **v1.0:** in-app capture tab + `zonot://capture` URL scheme (powers iOS Shortcuts).
- **v1.1:** iOS Share Sheet target + Android share intent + iOS Control Center quick capture + iOS Lock Screen / home widgets (iOS-primary).
- **v1.2:** voice capture (audio → `sources/` raw; transcription via the Tier-2 hosted-inference adapter).

### Save mechanism

**Dual-affordance:** explicit `Save` button (top-right, always visible) **plus** swipe-down-to-dismiss = save (iOS sheet idiom). Hardware `cmd+enter` on iPad. **Cancel is explicit only** (`×` button; confirms if body non-empty). No auto-save-on-background.

### Sync state model

**Two states, surfaced separately.**

- **DURABLE** = persisted to local SQLite + the capture queue; UI = soft haptic + 1.2 s "saved" toast. The user trusts the app at DURABLE; sync is invisible after that.
- **SYNCED** = the Worker has acked the write; UI = queue-depth indicator on the browse tab (no badge at zero; amber dot at depth ≥ 3; in-app notification when any item is stuck > 1 h).

**Failures stay quiet by default** — auto-retry with backoff; no modal blocks. **Settings → Sync details** exposes the full forensic surface (last sync, queue contents with retry counts, recent errors with RFC 9457 detail, token expiry, manual retry, log access, no-PII diagnostics export) — observability as the trust mechanism (ADR-0001) made tangible.

### Performance budgets (v1.0 targets; full table in spec)

Cold start → capture-ready ≤ 400 ms (iOS) / ≤ 1200 ms (Android floor); save tap → durable toast ≤ 80 ms / ≤ 200 ms; chip strip debounce 250 ms ± 50 ms; save → Worker ack p50 ≤ 1.2 s / ≤ 2 s; p99 ≤ 3 s / ≤ 5 s; idle memory ≤ 80 MB / ≤ 60 MB; FTS query p99 over 10 k local-mirror notes ≤ 50 ms / ≤ 150 ms. Enforced by a `perf:check` CI suite + manual real-device checks at phase exit.

### Reference devices

**iOS floor:** iPhone 12 / SE 3rd gen (A14/A15, iOS 17+). **iOS measurement target:** the maker's daily iPhone. **Android floor:** Google Pixel 6a (Tensor G1, 6 GB, Android 13+). **Constraint:** the maker does not own an Android device; v1.0 Android coverage is CI/emulator only; physical-device Android testing starts at v1.1 or with a used-6a purchase. Android-only regressions surface in CI, not dogfood — accepted because the wedge is iOS-primary.

### Browse / search screen

One surface (not a separate search tab): chronological feed grouped by day, native iOS-style search bar at top, facet chips (`tags · threads · type · when`) below opening multi-select sheets, settings gear top-right. Result row = title + inline tag chips + timestamp; search mode adds an FTS5 snippet with match highlighting. Tap row → read view; long-press → correction-surface quick-action sheet. No timeline/calendar treatment, no saved aggregations in v1.

### Read view

`react-native-marked` renderer; the compiled-truth / timeline body convention (ADR-0005) rendered as structured halves (compiled = prose markdown; timeline = dated-entry list with stylized `─── timeline ───` divider replacing the literal `---`). Inline `#tag` / `@thread` / `!type` render as tappable subdued chips → browse-filter. Wikilink `[[alias]]` tap-to-navigate ships in v1.0 (ambiguous matches → disambiguation sheet). Source pointer surfaces as `📎 raw source` footer link → fullscreen Sheet, read-only. Backlinks computed at view-open (FTS5 query for `[[<id>]]` + aliases); collapsed footer. The correction surface launches from a top-right kebab (edit / append / undo / delete) — all four ops at any age per ADR-0026 rev 14. A view-raw-markdown toggle ships in v1.0. **Share action is a three-option action sheet:** `Copy GitHub URL` (default; private-repo confirm) / `Copy raw markdown` / `Copy rendered markdown`; the chosen option becomes sticky-default for the session.

### Navigation architecture

**Two tabs:** `capture` (launch) + `browse` (with search). The read view is a screen at `/note/[id]` pushed onto the browse stack on row tap or via deep link. Settings is a stack rooted at a gear icon in the browse tab header. Expo Router file-based routing — `app/(tabs)/`, `app/note/[id].tsx`, `app/settings/`, `app/onboarding/index.tsx`. Deep links: `zonot://capture` (prefilled query params), `zonot://note/<id>`, `zonot://settings/sync-details`, `zonot://settings/auth`. Modal sheets (Fathom's `Sheet` primitive) for facet pickers, long-press action sheets, share / copy menu, confirm modals. Tab transitions instant.

### v1.0 auth UX

**Single-screen onboarding** at `/onboarding`: Worker URL field (encodes the path-secret per ADR-0013) + `Paste from clipboard` button + workspace field (free text until `Test connection` succeeds, then a dropdown of `list_workspaces()` results) + `Test connection` and `Connect` buttons. Worker URL stored in `expo-secure-store` (Fathom `keyChain.ts` wrapper) keyed `zonot.worker_url.<workspace>`. **Settings → Auth** shows Worker host, workspace, connection status, last-ok timestamp, `Re-test`, and a **Sign out / Reset** with two checkboxes: `Forget credentials` (forced on) + `Wipe local mirror` (optional, off by default). No token expiry warning at v1.0.

### v1.1 + v1.2 auth and onboarding evolution

v1.1 onboarding redesigns `/onboarding`: **primary CTA `Sign in with GitHub`** (managed C1) + secondary plain-text link `Self-hosted? Connect a Worker` (C0 path, unchanged). C1 flow: ASWebAuthenticationSession → universal-link callback → OAuth 2.1 + CIMD token exchange → **GitHub App install on an auto-created `zonot-notes` repo** (default; user can pick existing) scoped to **Contents:rw + Metadata:r on the one repo** per ADR-0017 → IAP modal (StoreKit 2 / Play Billing per ADR-0033) → land in capture. **v1.0 → v1.1 migration is no-op:** the app detects an existing `zonot.worker_url.*` secret and treats the user as already-onboarded C0. **Settings → Auth at v1.1** extends with identity card (avatar + GitHub login), connected repo + visibility, App install state + `Manage on GitHub`, token expiry + `Refresh now` + proactive refresh ~5 min before expiry, billing card. C1 sign-out confirm gains a third checkbox `Revoke Zonot's GitHub App access` (optional). **v1.2 hosted-inference consent** = a lazy first-trigger modal on first enrichment; copy names the guardrails (no retention, no training, monthly cap, cap-exceeded → Tier 0 raw). **Default OFF** per ADR-0027. Settings → Hosted Inference (new section): toggle, usage meter, model identifier, help link. Approaching-cap (≥80%) and cap-exceeded surface as passive notifications; capture never blocks.

### Correction surface UX

**Edit / append / undo / delete all available at any age** (ADR-0026 rev 14). Per-op flows: `Edit` opens the capture screen prefilled with compiled body only (timeline preserved); save → `correct` with `Edit-Of` trailer. `Append timeline entry` opens the capture screen prefilled with `- **YYYY-MM-DD** | source — ` stub. `Undo` shows a lightweight inline confirm modal. `Delete` shows a heavier modal with the button in `status.danger`. **Post-save snackbar undo at 4 seconds:** the DURABLE toast (1.2 s) is followed by an `[Undo · 4s]` mini-snackbar; tap → cancel the outbox row if not yet SYNCED, else enqueue an `undo` op. After 4 s the snackbar fades; the standard correction surface remains the path.

### Source `raw` field policy

A `sources/` node is written **iff** `raw !== output.body` after normalization, OR the capture surface produces a distinct artifact (audio, image, shared payload) that can't be inlined. Sequenced:

- **v1.0 in-app Tier-0 captures** — no source node (body IS raw; `Edit-Of` preserves pre-edit body via git history).
- **v1.1 share-extension / share-intent** — source node always written.
- **v1.2 voice captures** — source node always written.
- **v1.2 hosted-inference enriched captures** — source node always written, raw = user-typed, body = enriched.

The `WriteClient.capture()` interface is unchanged — core's byte-equality test decides materialization.

## Consequences

Phase 3 is scopable as discrete agent tasks: capture screen + parser + chip strip; sync state machine + queue + retry; Settings → Sync details; design system port + recolor; conformance test for tokens. Commit is at the load-bearing level (capture shape, sync model, perf envelope), not pixel layout — that lives in the spec.

## Open

Tag autocomplete from existing corpus (defer to a future rev once chip-strip telemetry signals demand).
