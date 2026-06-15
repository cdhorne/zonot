---
adr: 0018
title: Open questions register
status: Open
slug: open-questions-register
tags: [tracking]
---

# ADR-0018. Open questions register

## Context

A single home for live open questions. Each entry carries an inline status marker; resolved items keep their pointer for archaeology.

## Decision

1. **Tag normalization thresholds / policy.** ⚠ In-flight — v1 ships lowercase/trim/hyphenate/dedupe (ADR-0005 rev 16); full policy (gating vocab, stemming, synonyms) still open.
2. **Edge operational observability.** ✓ Resolved by [ADR-0035](0035-worker-runtime-discipline.md) (structured JSON logs + Workers Analytics Engine + Sentry from v1.0).
3. **RN isomorphic-git validation (pure-JS vs native).** ⏸ Deferred to post-MVP gating spike. Confirm the fs-adapter surface (expo-file-system / react-native-fs: `readFile/writeFile/readdir/stat/lstat/symlink`…) is complete — **verify `symlink`/`lstat` explicitly; they are the likeliest gaps** — then benchmark `depth:1` clone + pull + push **and the fetch→merge→re-push loop on a divergent push** against a ~20-50k-file corpus on a mid-range Android device (not a simulator). Pure-JS is the default; native libgit2 only if the benchmark fails ([ADR-0010](0010-reader-app.md)/[ADR-0022](0022-reuse-and-idioms.md)). Off the v1 critical path; gates the device git-sync upgrade.
4. **Provenance placement** — same-repo `sources/` vs separate repo. ⚠ In-flight — same-repo `sources/` is the v1 default; separate-repo is the privacy/bulk option not yet specified.
5. **Auto-classify edge model (Tier 2).** ✓ Resolved: Workers AI (on-edge, no third-party egress) or a no-retention API tier; narrow (light enrichment) + capped per the C1 hosted-inference guardrails ([ADR-0027](0027-longevity-and-revenue.md)/[ADR-0019](0019-cost-and-compute-budget.md)).
6. **Skill vs in-repo split nuance** ([ADR-0014](0014-docs-discipline-and-naming.md)). ⏸ Deferred — case-by-case; no policy yet.
7. **Name follow-through.** ✓ Resolved at brand-brief absorption (2026-06-14): name is **Zonot**; `zonot.app` reserved. Trademark clearance for the ZONOS adjacency and the `@zonot` handle sweep remain operational follow-through, not design questions.
8. **App-sync default.** ✓ Resolved: v1 reads+writes ride the edge HTTP path; device git-sync is the C0 / post-MVP ownership upgrade ([ADR-0010](0010-reader-app.md)).
9. **On-device enrichment model** — which model/size/quantization. ⏸ Deferred to post-MVP.
10. **Edit conflict-resolution policy.** ✓ Resolved: edge-mediated SHA-conditional (412 → refetch → reapply); the device-git divergence guard covers the post-MVP git path ([ADR-0010](0010-reader-app.md)/[ADR-0026](0026-operation-vocabulary.md)).
11. **Payment rail.** ⚠ In-flight — detailed in [ADR-0033](0033-billing-and-entitlement.md). The app rail is settled (IAP); the deferred web/CLI rail instrument stays open — **Helcim** if web buyers are mostly Canadian, a **Merchant-of-Record** if international. Grace/dunning and refund-revocation timing are resolved in ADR-0033.
