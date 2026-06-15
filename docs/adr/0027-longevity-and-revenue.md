---
adr: 0027
title: Graceful obsolescence, longevity & revenue posture
status: Accepted (rev 21)
slug: longevity-and-revenue
tags: [north-star, custody, distribution, cost, licensing, self-host]
---

# ADR-0027. Graceful obsolescence, longevity & revenue posture

## Context

A tool that asks you to entrust your knowledge must answer: what happens when the operator — or the maker — loses interest?

## Decision

### Graceful obsolescence (non-negotiable)

**The operator's *and the maker's* disappearance must be a non-event for the user's data.** Every feature must preserve the property that the user loses nothing structural if the operator vanishes. The guarantee is **structural, not promissory:**

- Data is already theirs — plain Markdown + git history in their own repo; readable in Obsidian/grep/any editor with zero loss on operator death (ADR-0001/0003).
- The operator is a **processor, not a store** — losing the service costs *convenience*, not the corpus; capture falls back to CLI / Claude-direct / hand-editing.
- Every boundary is a standard (ADR-0022) — the corpus plugs into the whole ecosystem even with Zonot gone.
- **The lever: a source-available, self-host-permitted open-core + the C0 self-host template** (ADR-0017 + §Mechanism below) — so the tool can be run, forked, and outlive the maker. The managed layer is closed; npm-published clients carry provenance (ADR-0023).

### Revenue posture

**C0 self-host is free forever** (the trust anchor + longevity mechanism; BYO-model, zero operator read). **C1 managed custody is the paid tier** — a small flat subscription for convenience (OAuth + one-click App install, hosted MCP), **~$2–5 CAD** (even $0.99–$2); with BYO-model its COGS ≈ the Workers floor. **Hosted inference (Tier 2, v1.2) is an opt-in C1 feature** with the guardrails below, included in C1 up to a monthly cap (opt-in, one SKU — not a separate tier; ADR-0033) so its bounded COGS is covered. Sell convenience, never access to your own data; hosted inference *is* a paid convenience, but BYO-model stays free-of-inference-charge and **C0 stays free**. GitHub Sponsors is a legitimate fourth leg.

### Hosted inference is the completeness lever for the no-agent tier

For the naive, no-agent user (ADR-0025 audience 2) hosted inference is the **only** enrichment path — BYO-agent, app-as-MCP-host-with-BYO-key, and deferred on-device models all require the user to *bring* a model (ADR-0002). So it is **load-bearing** for that tier, not optional — yet it stays behind the clean Tier-2 extension seam (ADR-0031 #7) so C0/self-host keeps the raw + BYO path and the operator-read floor. Economically it is the **highest-margin** user: light enrichment is ≈ cents/user/month (ADR-0019) against the $2–10 fee, so the civilian who pays *and* uses hosted inference out-monetizes a BYO-model developer.

### Hosted-inference guardrails

**Privacy:** opt-in, **no-train (contractually verified — ADR-0037)**, **retention bounded by the
upstream provider's DPA** (mitigation pending per ADR-0037; the user-facing claim softens until
either a Cloudflare rider lands or the v1.2 adapter switches to a provider with explicit zero
retention), **output-observable** (the `Model` trailer + plain-MD result *is* the trust mechanism,
ADR-0001/0007), scoped to captured content; **C0/BYO is the zero-operator-read floor**. **Cost:**
light enrichment only (tag/title/classify), small/cheap model, per-user caps — ≈ cents/user/month
(ADR-0002/0019). **Provider (shippable MVP):** v1.2 ships one hosted adapter, currently scoped to
**Workers AI OR Anthropic API direct** — the choice is the open item in ADR-0037 §Provider stack,
decided at v1.2 scoping based on rider outcome + COGS appetite. BYO = the agent harness (Tier 1),
so no user-facing provider config, no per-activity model tiers, no own-hardware — all future
adapters behind the extension point (ADR-0031 #7).

### Scope

Managed C1 enters v1 (ADR-0017/0020): **v1.0** dogfood (single-user, free) → **v1.1** managed C1 (first paid tier, BYO-model) → **v1.2** hosted inference. Sequenced so each step ships and validates.

### Mechanism: source-available non-compete licensing

(Absorbs ADR-0032.) With a paid C1 tier and well-funded adjacent competitors (GBrain, ADR-0025), the openness model must simultaneously preserve graceful obsolescence, let anyone self-host / run / fork, yet prevent a competitor from copying the repo and selling it as a competing hosted service. OSI-open licenses (MIT/Apache/AGPL) all permit commercial rehosting.

- **Open-core (maker-chosen).** The product is open and self-hostable — core, CLI, app, self-hostable Worker, C0 template, convention. The managed layer — multi-tenant control plane, billing, custody orchestration — is closed/private (needs no copy protection because it is never released).
- **Source-available, self-host-permitted, non-compete.** License the open part under a source-available non-compete instrument — recommended **FSL (Functional Source License)**, alternatively **BSL 1.1** with a self-hosting use-grant — which **converts to Apache-2.0 after ~2 years**. Permits self-host / run / modify / fork while forbidding offering it as a competing commercial service during the window; the time-conversion preserves long-term openness. (Avoid ELv2 / Commons Clause — they never convert.)
- **Final instrument confirmed at first release** (FSL vs BSL); the intent above is the decision.

Trade-off: source-available non-compete is not OSI "open source" — a modest community/reputation cost, possibly slightly less npm adoption. Accepted because the user-facing guarantees that matter (run, fork, own your data, longevity) are fully preserved; the restriction binds competitors, not users.

## Consequences

Revenue *need* is low by design, so generosity (free self-host) doesn't bleed. A beloved niche end-state is an honest, stable outcome, not a failure. The closed managed layer is the commercial moat alongside the non-compete term.

## Evolution

- ADR-0032 ("Licensing & openness") merged into §Mechanism at seed dissolution. Citations should now point at ADR-0027 §Mechanism.
- rev 21 (2026-06-14): user-facing privacy claim softened to reflect the validated Workers AI contractual ceiling (ADR-0037). "No-retention" was an overclaim; "no-train" verifies. Provider choice for v1.2 (Workers AI w/ rider vs. Anthropic API direct) deferred to v1.2 scoping per ADR-0037 §Provider stack.
