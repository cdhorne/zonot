---
adr: 0001
title: Observable plain files are the trust mechanism
status: Accepted (rev 5)
slug: trust-model-observability
tags: [north-star, custody]
---

# ADR-0001. Observable plain files are the trust mechanism

## Context

A tool that asks you to entrust your knowledge must make its trust mechanism legible. Zonot picks observability over encryption.

## Decision

- Trust comes from **observability, not encryption**. Every byte the agent writes lands as plain Markdown in a repo the user owns; raw input is preserved (verbatim at capture, in git history thereafter). The operator is a **processor, not a store**.
- **Custody is a disclosed, bounded, opt-in tier** (C0/C1, ADR-0017).
- **Hosted inference is bounded by the same rule (ADR-0027).** Tier-2 enrichment (C1) is **opt-in, no-retention, no-train, and output-observable** — the `Model` trailer + the plain-Markdown result let you inspect exactly what it produced. **C0 / BYO-model is the zero-operator-read floor.**

## Consequences

A derived index is a durable copy — needs to be ephemeral (ADR-0009). The audit guarantee lives in git history; force-push protection is a sensible default (ADR-0007), not a hard gate. Irreducible floor (managed): the GitHub App private key (ADR-0017); self-host (C0) is the only zero-custody option.
