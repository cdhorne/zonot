---
adr: 0030
title: Context-collection patterns (active capture)
status: Proposed (post-MVP)
slug: context-collection
tags: [capture, ergonomics, scope]
---

# ADR-0030. Context-collection patterns (active capture)

## Context

Beyond passive capture, the high-value lever is *proactively* collecting structured context — daily summaries, meeting outcomes, project deliveries — by intelligently prompting or scheduling.

## Decision

A **trigger + prompt-template layer over the existing write surface**, not new storage: a daily summary / meeting outcome / project delivery is still a **create or append** (ADR-0026). What's new is *when* and *how* capture is invoked:

- **Triggers:** scheduled (CLI cron, scheduled Worker), event-driven (agent / Claude-Code session hooks — nanobrain's session-end hook + idle drainer is the precedent), and mobile reminders / notifications.
- **Prompt templates** per pattern (daily / meeting / project), which the agent fills.
- All triggers are just **callers of the same capture/append handlers** (ADR-0021/0022) — origin- and trigger-agnostic.

## Consequences

Reduces capture friction with no new storage concepts and no operator involvement (client/agent-driven). The only v1 design hook (already satisfied): a trigger-agnostic capture surface.
