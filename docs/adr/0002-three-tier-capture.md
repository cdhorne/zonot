---
adr: 0002
title: Three-tier capture; push every interaction to the lowest tier
status: Accepted (rev 20)
slug: three-tier-capture
tags: [architecture, custody]
---

# ADR-0002. Three-tier capture; push every interaction to the lowest tier

## Context

Capture and enrichment can each run in different places; the question is where the model lives, not whether one is involved.

## Decision

- **Tier 0** — CLI -> GitHub directly. **Tier 1** — enriched API: client (Claude) enriched; edge validates + commits. **Tier 2** — auto-classify: edge runs a model. **In v1 (C1, at v1.2) as guardrailed hosted inference** — opt-in, no-retention, output-observable, small-model + capped (ADR-0027); ADR-0018 #5 picks the model.
- **Where the model lives (rev 20).** Enrichment always needs a model *somewhere*; the tier is just *where it lives*. **Tier 1** = the model the user already brought (their agent over MCP) — free to the operator, but only when capture originates **inside** an agent. **Tier 2** = the operator's model — the **only** enrichment path for an **agent-less** capture (raw app quick-capture, deterministic API, email-in). **MCP relocates this question, it does not remove it:** an app that "pushes to MCP" still needs a model behind it — either the user's BYO key (still requires a model sub) or the operator's (which *is* Tier 2). So for a **no-agent user, hosted inference is load-bearing**, not a convenience (ADR-0025/0027). On-device models would add a third locus but are deferred (ADR-0010); on-device *embedding* is search, not enrichment (ADR-0008/0009).

## Consequences

The ladder is the privacy gradient / trust budget: in-transit operator reads only at Tier 2 (ADR-0019). The reader’s on-device LLM (post-MVP) decouples enrichment locus from custody locus. Reused on read (ADR-0008).
