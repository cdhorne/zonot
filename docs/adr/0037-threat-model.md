---
adr: 0037
title: Threat model and operator data access
status: Accepted (rev 1)
slug: threat-model
tags: [trust, security, custody, scope]
---

# ADR-0037. Threat model and operator data access

## Context

ADR-0001's "operator is processor, not store" needs a concrete inventory: what data lives where,
what the operator can read at each tier, how credentials rotate, what an incident looks like.
Without this, the claim is a slogan rather than something a user can audit.

A second purpose: validate the upstream contract for hosted inference (Workers AI, v1.2). ADR-0027
asserted "no-retention, no-train" as the user-facing guarantee. The contractual language fetched
on 2026-06-14 supports the no-train claim but is silent on retention and carries an "improve the
Services" carve-out. The validation findings are documented below so the v1.2 plan can mitigate.

## Decision

### Threat actors (priority order)

1. **Operator-side compromise** — Zonot's Worker / KV / DO / Sentry compromised.
2. **Client-side compromise** — user's device or session stolen.
3. **In-transit interception** — TLS 1.3 + platform trust stores. No cert pinning.
4. **Supply chain** — npm provenance (ADR-0023), pinned deps, lockfile + `pnpm.overrides`.
5. **GitHub-side compromise** — accepted as substrate risk (ADR-0003); out of scope.

### Data class × tier matrix

| Data class | C0 (self-host) | C1 (managed) | C1 + hosted-inference |
|---|---|---|---|
| Note bodies | not operator | not operator | ephemeral via Workers AI (see §Workers AI ceiling) |
| Note titles | not operator | not operator | ephemeral |
| Tags | not operator | not operator | ephemeral |
| Other frontmatter | not operator | not operator | ephemeral |
| Source-node raw text | not operator | not operator | ephemeral on enrichment input |
| Commit messages / trailers | not operator | not operator | not operator |
| Filesystem path metadata | not operator | not operator | not operator |
| Workspace name | operator (dev tail only; hashed elsewhere) | hashed in metrics + Sentry | hashed |
| Workspace hash | operator | operator | operator |
| Op type | operator | operator | operator |
| Latency + status | operator | operator | operator |
| Trace id | operator (per-request, no cross-request correlation) | operator | operator |
| GitHub App private key | n/a | operator (sole durable secret) | operator |
| OAuth refresh tokens | n/a | operator (KV with TTL) | operator |
| Path-secret (v1.0) | n/a | operator (Worker env) | n/a |
| Sentry stack traces | operator (errors only, no body) | operator (no body) | operator (no body) |
| Logpush JSON logs | n/a | operator (no body; 7-day default) | operator (no body) |
| Entitlement state | n/a | operator | operator |
| Billing receipts (IAP) | n/a | operator (Apple/Google mediated) | operator |
| Edge-search index (v1.2) | n/a | n/a | ephemeral DO; cold tenants expose nothing (ADR-0009) |

### Bright lines

- **Note content** (body / title / tags / source raw / frontmatter) is never persisted operator-
  side at any tier. The v1.2 edge-search DO holds the index while warm; cold tenants expose
  nothing. Bodies pass through Workers AI on enrichment under the contractual ceiling documented
  below and the mitigations that follow.
- **Billing data and corpus data never share a system.** Entitlement KV is keyed on Zonot
  account; corpus access is through GitHub. A billing breach yields entitlement state, not note
  content.
- **One durable operator secret per tenant:** the GitHub App private key at C1. Everything else
  is short-lived or derivable.

### Credential rotation

| Credential | Lifetime | Trigger | Ceremony |
|---|---|---|---|
| Path-secret (v1.0) | manual | compromise or 90 days | Worker secret rotate; user re-enters URL |
| GitHub App private key (v1.1) | manual | annual or compromise | new key via GitHub UI; deploy to Worker; 24h overlap |
| OAuth access token | 1 hour | automatic | refresh-token rotation per OAuth 2.1 (single-use) |
| OAuth refresh token | 30d idle / 90d max | automatic | per OAuth 2.1 |
| User's GitHub PAT (C0) | user-controlled | user-controlled | user re-issues at GitHub; pastes new URL |
| IAP receipts | per StoreKit / Play | automatic | platform-handled |
| Sentry DSN | manual | annual or compromise | rotate in Sentry; deploy to Worker |

### Incident response

1. **Trace id** every error already carries; user pastes it.
2. **Settings → Sync Details → Export Diagnostics** bundles operation history (no content).
3. **Sentry events** correlate via trace tag.
4. **Credential compromise:** rotate per the table; revoke at the provider; in-app notify user.
5. **Body-content exposure:** can't happen by design at v1.0/1.1; v1.2 hosted-inference is the
   single path and is bounded by the Workers AI ceiling + mitigations.

### Workers AI contractual ceiling (verified 2026-06-14)

Source: <https://www.cloudflare.com/service-specific-terms-developer-platform/>

- **Training:** explicit — *"Unless otherwise agreed, Cloudflare does not use any Customer
  Content to train generative AI tools."* (Section 1.)
- **Retention:** silent. The only relevant clause is *"Cloudflare does not use any Customer
  Content except as needed to provide and improve the Services"* (Section 9). The "improve the
  Services" wording is a carve-out — it permits processing beyond delivery without specifying
  retention bounds.
- **Deletion rights:** silent for Workers AI specifically.
- **Third-party routing:** AI Gateway permits routing to third-party providers under separate
  terms (Section 4). The Cloudflare DPA does not apply to such third-party hops.

**Finding.** The user-facing claim "no-retention, no-train" implied by ADR-0027 was checked
against this contract. **No-train holds.** **No-retention is not yet contractually guaranteed.**

### Mitigations

**Operator-side behavioral-exposure discipline** — logs / Sentry / metrics show *who did what,
when* even though body content is excluded; mitigate by:

- **Workspace-name hashing** (SHA-256, truncated to 12 chars) in Sentry tags and Analytics Engine
  indexes. Raw workspace names land only in dev `wrangler tail` and are scrubbed before any
  Logpush sink.
- **Per-request trace ids** with no cross-request correlation operator-side. Sync Details never
  surfaces other users' trace ids.
- **Logpush retention default 7 days**; documented in the operator-side ops runbook.
- **"Don't read your own logs" operator hygiene rule** added to philosophy.md: logs exist to
  debug, not to browse for behavioral signal. The maker as operator binds to the same rule.

**Workers AI carve-out mitigation** (before v1.2 GA):

- **Path A (preferred):** obtain a written rider from Cloudflare specifying zero retention for
  Zonot's account and narrowing the "improve the Services" exclusion to explicitly bar retention
  of customer content. Block v1.2 GA on this rider.
- **Path B (fallback):** rev ADR-0027 to soften the user-facing claim to "no-train (contractual);
  retention bounded by Cloudflare DPA." Surface the actual ceiling in the v1.2 consent modal
  (mobile-spec §9.7).
- **No AI Gateway third-party routing in v1.2:** only direct Workers AI calls. The DPA gap on
  third-party hops is foreclosed by not crossing it.

**C0 / self-host as the behavioral-privacy floor.** A user who counts operator-visible behavior
as part of their threat model self-hosts. `zonot serve` (CLI Phase 2) is the on-device Worker
mirror; no operator behavior is visible at C0.

### Provider stack — compute vs. AI

The Workers AI contractual gap raises the question: switch AI provider, or switch compute too?
**They are separable.** Compute (Worker runtime, KV, Durable Objects, Logpush) and inference
(Workers AI) are independent products with independent contracts; ADR-0031 #7 already treats the
enrichment-model-provider as a typed extension point with a swappable adapter.

- **Compute stays Cloudflare.** The runtime lock-in was a deliberate trade-off (ADR-0028) and the
  data class × tier matrix above shows compute touches no body content at any tier. A different
  edge runtime (Vercel, Deno Deploy, Lambda@Edge) would re-platform multi-month work without
  changing the trust posture. Not on the table.
- **AI adapter for v1.2 is the open call.** Two candidates:
  1. **Anthropic API direct** — Claude family, the same model class the BYO-agent users already
     use. Enterprise terms commonly include explicit zero-retention + no-training. Higher COGS
     (~10–30× Workers AI per token); off-Cloudflare network hop adds ~50–200ms latency.
     Independent outage domain from the Worker — operationally clean (one-of-two failure modes).
     Stronger reputational fit with the Zonot wedge ("the agent users already chose").
  2. **Workers AI with rider** — keep the current adapter; negotiate a written rider before v1.2
     GA narrowing the "improve the Services" carve-out + specifying zero retention. Lower COGS;
     same network as the Worker (lower latency); requires negotiation that may not land.
- **Decision deferred to v1.2 scoping.** The architecture supports either via the same extension
  point. The decision input is the rider negotiation outcome + the v1.2 cost model + whether
  the Claude-family reputation lift is worth the COGS multiple.

This ADR captures the *question*; ADR-0027 rev 21 absorbs the *consequence* (the user-facing
claim softens until whichever path lands).

## Consequences

- ADR-0027 gets a rev (rev 21) to match the validated contractual ceiling. Phrasing softens to
  "no-train (contractual); retention bounded by Cloudflare DPA (mitigation pending Path A or B
  per ADR-0037)."
- Mobile-spec §9.7 (hosted-inference consent) gains an honest copy update naming the actual
  ceiling, not the marketing claim.
- Worker-spec §2.4 cross-references this ADR and the operator-side ops runbook (closed-source /
  internal) gains the workspace-hashing rule, Logpush 7-day default, and the "don't read your
  own logs" hygiene rule.
- Philosophy.md gains the "behavioral privacy → C0" honest disclosure with the mitigations.

## Open

- **Path A vs Path B for the Workers AI ceiling** — decided when rider negotiation completes or
  when v1.2 scoping firms up. Whichever lands, blocks v1.2 GA.
- **Sentry `beforeSend` test fixture** — worker-spec §2.3's stripContent discipline currently
  relies on disciplined coding. Phase 1 should ship a runtime test that throws an error with a
  body in scope and confirms Sentry receives no content. Track but not blocking.
