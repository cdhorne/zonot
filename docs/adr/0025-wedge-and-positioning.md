---
adr: 0025
title: Product wedge & competitive positioning
status: Accepted (rev 20)
slug: wedge-and-positioning
tags: [positioning, north-star, scope]
---

# ADR-0025. Product wedge & competitive positioning

## Context

The category crystallized in 2026 (Karpathy's "LLM wiki" → GBrain at ~22k stars, Basic Memory, nanobrain). Zonot must state where it is differentiated and where it would be entering a crowded lane.

## Decision

### The wedge

Zonot is the **connected mobile read/write notes client** that bridges on-the-go capture/reading with a desktop-centric, git-native, agent-enriched workflow. Mobile is the differentiated front door; the desktop (Obsidian / Claude / CLI / grep) is the reused workshop; plain Markdown in the user's git repo is the wire.

### Two audiences

Zonot serves **two user types that keep each other honest:**

1. The **git-native developer** who brings their own agent (Tier-1 BYO over MCP) — the wedge above, for whom files-as-truth / observability is the front-of-house pitch.
2. A **naive, no-agent user** who pays the flat C1 fee and wants the app to enrich itself via **Tier-2 hosted inference** (ADR-0002/0027), for whom the ethos is back-of-house insurance and "it just works" is the pitch.

The maker is audience (1) and dogfoods daily; less-technical peers are the audience-(2) test cohort. This is a deliberate, modest consumer-ward repositioning — accepted because the two audiences cross-check scope and honesty (the developer keeps it observable/ownable; the civilian keeps it complete and frictionless) and because the no-agent user is the **highest-margin** user (ADR-0027). The app's standalone, **agent-free onboarding** is a first-class design surface.

### Files are the truth (non-negotiable)

The Markdown files are the system of record; every index/DB is derivable and disposable (tightens ADR-0001/0009). The deliberate inverse of GBrain (Postgres = truth, Markdown = projection) and of vendor memory (opaque, in-custody). Do not build on / couple to GBrain; stay loosely **convention-compatible** (read its files; don't depend on its DB-only graph — related is computed, ADR-0006).

### Differentiation

Hosted-edge MCP (no install) + pure-git ownership + a mobile read/write bridge — the combination GBrain/Basic Memory/nanobrain leave empty (all desktop/CLI engines with no mobile read client). **Restraint is positioning** (no vector sprawl, no arbitrary-edit surface), against a market sprinting toward edit-/vector-heavy agent memory.

### Complement, not competitor

**Obsidian** (mid-2026: no AI/agent on its public roadmap; AI is community plugins) is a *reader of the substrate Zonot writes* — be a feeder, not a rival. **Claude / vendor memory** is vendor-custody, opaque, per-vendor — its existence *strengthens* the "your repo, every tool, forever" pitch; position Claude as a client that writes into your repo.

### Watch-list (monitor, don't build)

Obsidian Web Clipper's "Interpreter" creeping toward native enrichment; a model vendor shipping an MCP-native, repo/file-backed memory product with the ownership framing — the plausible future encroachment (Anthropic's file-based Memory Tool and Claude Code's owned-file memory show the category converging on "memory as owned files").

## Consequences

The moat is the *combination* + the ethos, not "files as memory" alone. Targeting people already fully inside Obsidian is the weak spot.
