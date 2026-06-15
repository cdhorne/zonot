---
adr: 0033
title: Billing & entitlement architecture
status: Accepted (rev 22)
slug: billing-and-entitlement
tags: [billing, distribution, custody, revenue]
---

# ADR-0033. Billing & entitlement architecture

## Context

The paid C1 tier (ADR-0017/0027) needs billing. Buyers arrive through two origins — the mobile app and web/CLI — under different platform rules. The maker reuses a self-hosted subscription backend (Fathom's RevenueCat replacement).

## Decision

**One SKU, off-by-default, included cap.** One entitlement store keyed to the Zonot account; payment sources are adapters (mirrors ADR-0031). Hosted inference is a single SKU with an opt-in included cap, not a separate tier.

### The spine — one entitlement store

A server-authoritative *entitlement* store keyed to the **Zonot account** (the OAuth / GitHub identity, ADR-0017) — *not* to a store transaction — so a user who buys on the app and on the web is **one** entitlement. It records: C1 active flag, **tier** (custody-only vs +hosted-inference, ADR-0027), validity window. The Worker checks it per request; the rest of the system never sees the payment source.

### App rail (v1.1, mandatory IAP)

In-app digital subscriptions **must** use **app-store IAP** (Apple Guideline 3.1.1 / Google Play Billing) — no PSP inside the app. Reuse Fathom's RevenueCat-replacement backend for server-side **receipt validation** (StoreKit 2 / Play Billing) and **store server-notifications** (App Store Server Notifications v2, Google Play RTDN) so renewals / cancels / refunds / billing-retry update entitlement automatically. Apple/Google collect and remit sales tax for IAP and take the 15% small-business cut (under ~$1M/yr), so the app rail's tax burden is largely handled by the stores. *(Store commercial terms shift — verify at build.)*

### Web/CLI rail (deferred — ADR-0018 #11)

Add **one** PSP/MoR adapter that writes the *same* entitlement store when web paid-demand appears. Web buyers purchase out-of-app, so in-app anti-steering rules don't bind. Choice by tax appetite + geography: **Helcim** (Calgary, interchange-plus, CAD-native) if buyers are mostly Canadian; a **Merchant-of-Record** (Paddle / Lemon Squeezy) if international sales matter and global VAT offload is wanted.

### Packaging — opt-in included cap, one SKU

Hosted inference (v1.2) is **not a separate tier**: it is included in C1 up to a monthly cap, **opt-in** (off by default — the operator-read consent, ADR-0027). The naive user gets a complete app with no second purchase; the privacy-conscious user leaves it off (base C1 = pure BYO, zero operator read). The cap bounds COGS against the $2–10 fee. **Cap-exceeded never blocks capture:** past the cap a capture still lands **raw (Tier 0)**, re-enrichable later by an agent — only *enrichment* degrades (ADR-0004). A heavy-user overage / pro cap is a future option.

### Entitlement lifecycle — generous grace, clean revoke

**Failed renewal:** honor the store's native billing grace (Apple/Google ~16-day grace / account-hold) and the PSP's smart-retry (~7–14-day grace) on the web rail; entitlement stays active through grace, flipping inactive only on final expiry. **Refund / chargeback:** the entitlement store consumes the refund signal and revokes at the refund's effective time; chargebacks flag operationally.

### Guardrail

**Billing data is operator-side only — it never touches the user's repo/corpus** (operator-as-processor, ADR-0001). Entitlement is derivable, disposable state. **Graceful obsolescence holds:** losing C1 / the operator costs convenience, not data — C0 self-host stays free and billing-free (ADR-0027); no payment identity is required to own or read the corpus. Billing state gates only managed convenience; within an active entitlement, capture always succeeds (the cap degrades enrichment, never capture).

## Consequences

The app ships **IAP-first** (the v1.1 paying cohort is app users); the web rail is additive, not a v1.1 blocker. One entitlement store reconciles many sources, so adding a rail is a webhook + an adapter, never a re-architecture. The 15% SBP store cut is accepted as the cost of the app's distribution + tax handling.

## Open

Only the **web-rail instrument** (Helcim vs Merchant-of-Record, ADR-0018 #11) — decided at web-rail time.
