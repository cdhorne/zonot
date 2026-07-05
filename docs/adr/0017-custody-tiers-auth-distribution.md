---
adr: 0017
title: Custody tiers, auth, and distribution
status: Accepted (rev 17; C1 enters v1 at v1.1)
slug: custody-tiers-auth-distribution
tags: [auth, custody, distribution, self-host]
---

# ADR-0017. Custody tiers, auth, and distribution

## Context

The custody tier ladder is the privacy/trust gradient; auth and distribution shape who can sign up and how.

## Decision

Two tiers; user picks; app-store default C1.

- **C0 — zero custody (self-host / BYO).** User supplies their own GitHub App / PAT; operator holds nothing. (The git-syncing app, ADR-0010, is the natural C0 client.)
- **C1 — managed custody.** Repo in the user's own GitHub account. GitHub App scoped to **Contents: read-write + Metadata: read only**, installed on **only the one notes repo**; holds durably **only the App private key**; mints short-lived tokens per request; persists none.
- **MCP auth:** OAuth 2.1 + CIMD (DCR deprecated fallback); RFC 9728 PRM; RFC 8707; Streamable HTTP; no token passthrough.
- **Onboarding wrapper (C1):** OAuth in + one App-install click on an auto-created repo; set sensible repo defaults (incl. force-push protection); write per-user config.

**Sequencing (rev 17).** C1 managed custody **enters v1 at v1.1** (ADR-0020), no longer Phase 2 — the OAuth 2.1 + GitHub App + token-minting stack is now in v1 scope. v1.0 remains single-user (path-secret + PAT, ADR-0013); C1 hosted inference follows at v1.2 (ADR-0002/0027).

## Consequences

Per-token capability bounded to one repo for <=1h. Population breadth: the App key spans all C1 installs — the irreducible C1 floor; minimize, don't pretend to erase. No-GitHub mass-consumer not served. App-store: fine fit.

## Open

App-sync default (lean C0); onboarding partial-failure recovery (design pinned in
[managed-spec §5](../specs/managed-spec.md); closes when v1.1 4(d) ships); directory submission.
