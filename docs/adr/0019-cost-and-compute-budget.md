---
adr: 0019
title: Cost and trust budget
status: Accepted (rev 5)
slug: cost-and-compute-budget
tags: [cost, performance, custody]
---

# ADR-0019. Cost and trust budget

## Context

A tool that asks people to entrust their knowledge needs honest economics; the cost story is a trust signal.

## Decision

- **It's text; it's cheap.** No egress charges; FTS avoids full scans; the real floor is the $5/mo Workers Paid base.
- **Two rules:** (1) never build/rebuild the index on the read path; (2) rebuild in bulk (Git Trees API + tarball) — the constraint is GitHub's rate limit, not dollars.
- **Trust budget:** in-transit operator reads only at Tier 2; the operator-free C0 reader touches the operator at no point.
- **Revenue posture (ADR-0027).** Base inference is client-side (Tier 1) and storage is the user's repo, so base operator COGS ≈ the Workers floor; **C1 hosted inference (v1.2) adds *bounded* Tier-2 COGS** (next). The paid tier sells *convenience* (managed custody + optional hosted inference), never access to your own data.
- **Tier-2 hosted-inference COGS (C1, rev 17).** Bounded by design: **light enrichment only** (tag/title/classify, small token counts), a **small/cheap model** (Workers AI or a no-retention API), and **per-user monthly caps** (degrade to BYO past the cap). ≈ cents/user/month; the C1 price covers it (ADR-0027).
