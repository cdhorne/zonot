---
adr: 0012
title: Version the note convention from day one
status: Accepted
slug: convention-versioning
tags: [data-model, migration]
---

# ADR-0012. Version the note convention from day one

## Context

Live dogfood will churn the convention; without a version field and forward migrations in core, every churn risks orphaning earlier captures.

## Decision

Every note carries `v: 1` from the first capture; convention changes ship with a forward migration (in the core); readers tolerate known prior versions.

## Consequences

Absorbs the live-dogfood churn risk; migrations are observable, reversible.
