# Security Policy

Zonot's entire pitch is **trust through observability and ownership** (ADR-0001): your notes land as
plain Markdown in a repo you own, and the operator is a *processor, not a store*. Security reports
that protect that property are taken seriously.

## Status

Zonot is **pre-release** (seed stage — see [`docs/adr/`](docs/adr/)). There are no published releases
or hosted tiers yet, so there is no supported-versions table. Until v1.0 ships, the supported version
is the `main` branch.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via either:

- **GitHub Security Advisories** — [open a private report](../../security/advisories/new) (preferred;
  keeps the disclosure and fix coordinated in one place), or
- **Email** — cdh612@gmail.com with `SECURITY` in the subject line.

Please include: what you found, how to reproduce it, the affected component
(`packages/core`, `apps/worker`, `apps/cli`, `apps/mobile`), and any impact assessment. A proof of
concept helps but is not required.

You'll get an acknowledgement within a few days. As a solo, pre-revenue project there is no formal SLA
or bug-bounty yet; coordinated disclosure is handled in good faith and credited unless you prefer
otherwise.

## Scope and threat model

The trust boundaries, what the operator can and cannot see, and the custody tiers (C0 self-host
through C1 managed) are documented in [ADR-0037 — Threat model and operator data access](docs/adr/0037-threat-model.md).
Reports that demonstrate a gap between that model and the implementation are especially valuable —
for example, anything that lets the operator read content it claims not to, breaks write
idempotency/atomicity, or corrupts the convention envelope.

Out of scope: findings in third-party dependencies (report those upstream; tell us so we can pin or
patch), and theoretical issues without a realistic attack path.
