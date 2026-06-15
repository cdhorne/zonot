# Dogfood discipline

How Zonot is dogfooded. Three alarm classes. **Phase exits = alarms stay green under real use.**
Numbers are collected for observation, not as gates.

## Principle

Phase exit measures whether the *system* stays trustworthy, not whether the *maker* did enough
reps. The maker uses Zonot as they actually use it. If something degrades, an alarm fires. When
no alarm has fired for the relevant window and the maker trusts daily reliance, the phase is
done. Quiet weeks don't earn an exit; degraded days reset confidence.

## Alarm classes

### 1. Correctness — invariants that can NEVER violate

Any breach is page-level. The system has broken its own contract.

```
- Conformance test red on main (CI gate)
- SHA-conditional write succeeds against a stale base_sha (atomicity broken)
- Idempotency replay returns a different result for the same body + key
- Sentry breadcrumb / event contains body / title / tag content (strip discipline broken)
- Provenance trailer malformed or missing on any commit
- Write outside the notes/ or sources/ tree (convention envelope breached)
- Hosted inference invocation without explicit user consent (Tier-2 boundary broken)
- Any commit lacking Capture-Id / Edit-Of / Undo-Of / Delete-Of trailer (ADR-0007)
- Any write that produces a non-byte-identical envelope across runtimes (conformance)
```

Surface: Sentry alert email to the maker; CI failure on main; runtime assertion logs.

### 2. Reliability — degradation surfaces

Threshold breach over a window = alert. Starting values listed; tune after first dogfood cycle.

```
- p99 capture→ack latency > budget over trailing 15 min          (budgets in [`specs/perf-budgets.md`](specs/perf-budgets.md))
- 5xx rate > 1% over trailing 60 min
- 4xx-conflict (412/422) rate > 5% of writes over trailing 60 min  (suggests a client bug)
- Mobile outbox queue depth > 3 sustained > 5 min
- Mobile any-item-stuck > 1h
- Worker cold-start p99 > 50ms over trailing 60 min (per perf-budgets.md §3)
- Repo write rejected by GitHub > 0 outside known rate-limit windows
- Token expiry within 7 days without successful refresh (v1.1+)
- FTS query p99 over local mirror > budget (per perf-budgets.md §4 CLI / §5 mobile)
- CI bench regression > 2× baseline on any tracked function (per perf-budgets.md §6)
```

Surface: Analytics Engine queries + Sentry alert rules; mobile in-app passive notifications.

### 3. Trust — non-negotiable boundary guards

Breach = stop dogfood, investigate before resuming. The trust ethos is structural; these test it.

```
- Any operator-side log / Sentry event with a content field populated
- Any inference call to a provider other than the configured Tier-2 adapter
- Any GitHub App permission scope drift beyond Contents:rw + Metadata:r
- Any path-secret / OAuth token visible in logs or error responses
- Any Logpush sink receiving content (workspace-name unhashed; body bytes; etc.)
- Any C0 self-host invocation producing operator-side traffic
```

Surface: Sentry alert email (top severity); CI fixture tests for the strip / scope / log
discipline.

## Numbers collected (for observation, not for gates)

These metrics roll up in Analytics Engine + Sentry but **don't gate phase exit.** They're the
operator's awareness layer.

```
- captures / day / workspace (hashed)
- corrections / day / workspace
- imports / week / workspace
- mobile foreground time / day (client-side; not operator-side)
- search queries / day / workspace
- agent-tool invocations / day / workspace (MCP path)
- average sync round-trip / day
```

Use these to **understand patterns**, not to enforce thresholds. If the maker captures 3 days
a week and the alarms stay green, the phase is fine. If captures spike to 100/day and alarms
fire, the spike is the signal.

## Daily watch surface (optional, not required)

If the alarm hierarchy is right, the maker shouldn't need to scan logs. But during early
dogfood the habit catches blind spots:

```
1. Mobile Sync Details:    queue depth = 0? last sync < 1h ago? any failed-permanent?
2. Wrangler tail:          tail in a tmux pane; eyeball errors only
3. Sentry dashboard:       errors last 24h (should be 0 most days)
4. Repo activity:          git log --oneline --since=yesterday  (sanity check)
5. zonot doctor:           run once; env / config / perms / reachability green
```

`zonot doctor` auto-runs on `zonot capture` if last-run > 24h, so the maker gets the check for
free without remembering it.

## Phase exit rule

A phase exits when:

```
- All correctness alarms have stayed green continuously since phase start
- All reliability alarms have stayed green continuously during a recent window of real use
- All trust alarms have stayed green continuously since phase start
  (one breach restarts the window; trust isn't a sliding average)
- CI conformance green on every main commit during the window
- The maker trusts daily reliance — subjective but real
```

No minimum capture count. Quiet weeks don't earn the exit; they postpone it (alarms can't
prove green without traffic). Degraded days don't reset the calendar but they reset confidence.

## Alarm config home

Operator-side alarm configuration lives in the Sentry + Cloudflare Analytics Engine setup
(see [`specs/worker-spec.md`](specs/worker-spec.md) §2.2–2.3 for the underlying observability
surface). Client-side alarm thresholds (mobile queue depth, stuck items) live in
[`specs/mobile-spec.md`](specs/mobile-spec.md) §3.5.

CI alarms (conformance + invariant fixtures) live in the test suite at
`packages/core/test/conformance/` (per [`specs/core-spec.md`](specs/core-spec.md) §4).

Per-runtime latency / throughput / memory budgets — which the reliability alarms watch — live in
[`specs/perf-budgets.md`](specs/perf-budgets.md). CI bench discipline (regression detection,
baseline storage, scope per runtime) is in §6 of that doc.
