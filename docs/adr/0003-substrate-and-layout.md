---
adr: 0003
title: Substrate — Markdown in the user's GitHub repo, one repo per workspace
status: Accepted
slug: substrate-and-layout
tags: [storage, layout]
---

# ADR-0003. Substrate: Markdown in the user's GitHub repo, one repo per workspace

## Context

Storage substrate and on-disk layout are load-bearing; the convention has to be obvious and compatible with `grep` / Obsidian / any editor.

## Decision

Plain Markdown, **one repo per workspace**. Layout: `notes/YYYY/MM/<id>-<slug>.md`; `sources/YYYY/MM/<id>.md`. git over new-file-per-note already *is* the append-only log.

## Consequences

Date-partitioning bounds directory size. Provenance defaults to same-repo `sources/`; separate-repo is the privacy/bulk option (ADR-0018).
