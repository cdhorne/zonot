---
adr: 0013
title: Single-user, remote Worker as the live test harness
status: Accepted
slug: phase-1-deployment
tags: [phasing, auth, hosting, testing]
---

# ADR-0013. Single-user, remote Worker as the live test harness

## Context

Testing the edge surface in isolation buys little; the live deployed Worker is the only honest test for what the maker actually uses.

## Decision

A **deployed remote Worker** over HTTPS (Streamable HTTP). Connector auth: **path-secret URL**. GitHub auth: one fine-grained PAT in a Worker secret. Static workspace map. **Testing = live dogfood.** The app talks to this same Worker.

**Sequencing (rev 17).** This single-user harness is **v1.0** (the dogfood loop). **v1.1** introduces multi-tenant **managed custody (C1, ADR-0017)** — so architect multi-tenant and the Tier-2 enrichment seam from day one, even though v1.0 ships single-user.

## Consequences

The Worker is Phase 1. Keep the data model operator-agnostic to keep self-host open.
