---
adr: 0014
title: Documentation discipline and naming
status: Accepted (rev 10)
slug: docs-discipline-and-naming
tags: [docs, naming]
---

# ADR-0014. Documentation discipline and naming

## Context

A consistent doc structure and a single canonical name per concept is cheap up front and expensive to retrofit; the project name itself needs due diligence.

## Decision

Small fixed doc set; ADRs one-idea-per-file, numbered, append-only once sealed. Repo-specific ADRs in-repo; general knowledge graduates to a skill (nuance parked). One canonical name per concept; **no theming** — no nautical/archive metaphors in code or docs; no Maya glyphs or "sacred well" mysticism; no fantasy/gaming cues. Water-feel in voice and palette, never as overt naming in code. **Name: Zonot** — evokes a small, calm opening above a deep, clear, connected store. Brand brief at `docs/brand/brief.md`; provenance footnote in `docs/philosophy.md`.

**Name due diligence.** Chosen after the brand pass that absorbed the brief: trademark-clear in US (USPTO) and Canada (CIPO); the ZONOS (Class 42 SaaS) adjacency is the one remaining clearance call. **`zonot.app` is open** (ship there); `zonot.com` is parked. npm `zonot` already free; GitHub org / `@zonot` handles to be reserved across platforms.

## Open

GitHub org reservation; `zonot.app` registration; ZONOS clearance opinion (ADR-0018 #7).
