---
adr: 0006
title: Lineage — authored note<->source and thread; related is computed; history in git
status: Accepted (rev 4)
slug: lineage
tags: [data-model, lineage]
---

# ADR-0006. Lineage: authored note<->source and thread; related is computed; history in git

## Context

Lineage is the graph of authored vs. computed edges; getting the boundary right keeps the data model honest and avoids re-implementing graph DBs in YAML.

## Decision

Two authored edges: **note<->source** and **`thread`**. **Related is computed** (`search(seed=note)`). **No supersession field** — evolution is an edit; git is the append-only record.

## Consequences

Append-only lives at the git layer. Tag-cohort/time-window are ranking inputs only.
