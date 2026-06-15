# Performance budgets

Consolidated per-runtime performance budgets and the CI bench discipline that enforces them.
Each budget is a number; each number is the threshold for a reliability alarm
([`docs/dogfood.md`](../dogfood.md) §2).

## 0. Scope

What this spec pins:

1. Per-runtime budget tables (core / worker / CLI; mobile lives in [mobile-spec §5](mobile-spec.md#5-performance-budgets)).
2. Reference hardware that anchors the numbers.
3. The CI bench discipline — tooling, baseline storage, regression-detection model, scope per
   runtime.
4. Open items for Phase 1 bench setup (staging Worker, fixture corpus).

What this spec does not pin:

- Mobile budgets — they live in [`mobile-spec.md`](mobile-spec.md) §5 (already specced per
  ADR-0034). Cross-referenced from this doc rather than duplicated.
- Internal optimization choices (caching strategies, query plans). The budgets are the contract;
  implementation is the runtime's call.

## 1. Reference hardware

| Runtime | Reference | Used for |
|---|---|---|
| Core | Maker's daily MacBook (Apple Silicon, Bun JIT warm) | Per-PR CI bench; manual local check |
| CLI | Maker's daily MacBook | Per-PR CI bench (GitHub Actions Linux runner, regression-detection) |
| Worker | Cloudflare Workers paid tier, default region | Nightly staging bench against real workerd |
| Mobile | iPhone 12 / SE 3 (floor) + maker's daily iPhone (target); Pixel 6a (Android floor) | Manual at phase exit per [mobile-spec §5](mobile-spec.md#5-performance-budgets) |

GitHub Actions runners (`ubuntu-latest`) are noisy enough that strict assertions false-positive
~10–30%. The bench discipline (§6) uses regression detection to tolerate runner jitter.

## 2. Core budgets — `packages/core`

Pure functions; sub-millisecond medians expected. Run under `bun:test` + `mitata`.

| Function | Median | p99 |
|---|---|---|
| `serializeFrontmatter` | 1 ms | 5 ms |
| `parseFrontmatter` | 3 ms | 15 ms |
| `splitBody` (10 KB body) | 2 ms | 10 ms |
| `slugify` | < 1 ms | 2 ms |
| `normalizeTags` | < 1 ms | 2 ms |
| `IndexWriter.upsertNote` (one sqlite tx) | 5 ms | 20 ms |
| `SearchEngine.search` (10k notes) | 10 ms | 50 ms |
| `SearchEngine.list` faceted (10k notes) | 15 ms | 80 ms |
| Build convention envelope (full capture pipeline, no I/O) | 10 ms | 40 ms |

Cross-reference: [`core-spec.md`](core-spec.md).

## 3. Worker budgets — `apps/worker`

End-to-end latencies include the GitHub round-trip where applicable. The Worker's own internal
time is a fraction of these; the budget bakes in upstream cost.

| Operation | Budget |
|---|---|
| Cold start (workerd boot) | ≤ 50 ms p99 |
| Capture handler (internal time only, post-warm) | ≤ 100 ms p99 |
| Capture end-to-end (incl. GitHub) | ≤ 1.5 s p99 |
| Append / correct / undo / delete (end-to-end) | ≤ 1.5 s p99 |
| Read note (one Contents call) | ≤ 800 ms p99 |
| `list_workspaces` / `list_tags` (KV cached) | ≤ 200 ms p99 |
| `list` faceted (v1.0/1.1, GitHub-backed) | ≤ 1.5 s p99 |
| `list` faceted (v1.2, edge index) | ≤ 200 ms p99 |
| Concurrent requests per workspace (sustained) | ≥ 10 req/s without 429 |

Cross-reference: [`worker-spec.md`](worker-spec.md).

## 4. CLI budgets — `apps/cli`

Both backends (clone-holder local + worker thin-client) are bench-targeted; numbers differ.

| Operation | Budget |
|---|---|
| Cold start (Bun-compiled binary launch to ready) | ≤ 100 ms p99 |
| `zonot capture` (local backend) | ≤ 200 ms p99 |
| `zonot capture` (worker backend) | matches Worker §3 |
| `zonot read` (local backend) | ≤ 50 ms p99 |
| `zonot search` over 10k local mirror | ≤ 50 ms p99 |
| `zonot list` faceted over 10k local mirror | ≤ 80 ms p99 |
| `zonot import` throughput (batched, local backend) | ≥ 50 notes/s |
| `zonot doctor` end-to-end | ≤ 500 ms p99 |
| Idle memory ceiling | ≤ 80 MB |

Cross-reference: [`cli-spec.md`](cli-spec.md).

## 5. Mobile budgets — see [mobile-spec §5](mobile-spec.md#5-performance-budgets)

Mobile budgets are pinned in `mobile-spec.md` §5 (per ADR-0034). Not duplicated here.

Summary for reference:

| Operation | iOS daily | Android floor |
|---|---|---|
| Cold start → capture ready | ≤ 400 ms | ≤ 1200 ms |
| Save tap → durable toast | ≤ 80 ms | ≤ 200 ms |
| Save tap → Worker ack p50 | ≤ 1.2 s | ≤ 2.0 s |
| FTS query p99 over 10k mirror | ≤ 50 ms | ≤ 150 ms |
| Idle memory | ≤ 80 MB | ≤ 60 MB |

See mobile-spec for the full table and the reference-device commitment.

## 6. CI bench discipline

### 6.1 Tooling

- **`mitata`** for Bun-runtime benches (core, CLI). Bun-native, accurate, low-overhead.
- **Custom integration harness** for Worker (calls a deployed staging Worker over HTTPS;
  measures end-to-end). Phase 1 task.
- **Mobile bench is manual** in v1.0 (Detox / Maestro is high-overhead; deferred to v1.1).

### 6.2 Regression detection (not strict assertion)

Strict `p99 ≤ X` assertions false-positive ~10–30% on GitHub Actions runners. The bench
discipline uses regression detection:

- Each PR compares current run against baseline.
- Fail when regression > **2× baseline** (initial threshold; tighten after first month of data).
- Runner jitter is invisible; real regressions are loud.

### 6.3 Baseline storage

Baselines live in **GitHub Actions artifacts**, not in the repo:

- Updated on every green main build (workflow uploads the new baseline as an artifact named
  `bench-baselines-<runtime>`).
- PR workflow downloads the latest main artifact, compares, posts a comment summarizing
  diff vs. baseline.
- Artifact retention: 90 days (GitHub default). If a baseline ages out, the next main build
  re-establishes it; PRs during that window skip regression detection with a warning.
- No commit pollution; no race conditions on baseline writes.

Trade-off accepted: less audit trail than a repo-committed baseline; mitigated by the workflow
posting baseline numbers to the PR comment so they're at least visible in PR history.

### 6.4 Bench scope per runtime

| Runtime | When | Tooling | Mode |
|---|---|---|---|
| Core | Per-PR | `mitata` | Regression detection (2× threshold) |
| CLI | Per-PR | `mitata` | Regression detection (2× threshold) |
| Worker | Nightly cron | Custom HTTP harness against staging | Strict assertion (full GitHub round-trip is honest) |
| Mobile | Manual at phase exit | iPhone + Pixel 6a real-device | Manual review against [mobile-spec §5](mobile-spec.md#5-performance-budgets) |

### 6.5 Bench fixtures

- **Core / CLI:** a deterministic 10k-note fixture corpus seeded by ULID + frontmatter generator;
  committed to `packages/core/test/bench/fixtures/`. Reproducible across machines.
- **Worker:** the staging Worker is seeded with the same fixture corpus once during Phase 1
  setup; reset weekly via a workflow that calls `zonot import` against staging.
- **Mobile:** the same fixture corpus, loaded via a debug-build helper before phase-exit bench.

## 7. Phase 1 setup tasks

Tracked here so they don't get lost when Phase 1 (Worker) scoping happens:

- Provision a `staging.zonot.app` (or `zonot-staging.workers.dev`) for nightly bench.
- Wire the `bench-baselines-<runtime>` artifact upload/download workflow.
- Seed the staging Worker with the bench fixture corpus.
- Write the per-PR bench-comparison workflow + the PR comment template.
- Decide whether the regression-detection threshold tightens from 2× to 1.5× or 1.3× after the
  first month of data.

## 8. Open items

- **Regression threshold tightening** post-month-one (above).
- **Worker staging cost** — running a nightly bench against a real workerd plus daily GitHub
  round-trips burns a small amount per month; track and tune.
- **Cross-platform CLI bench** — the maker's MacBook is the local reference; CI runs on Linux.
  The regression-detection model abstracts this away (each platform has its own baseline) but
  budgets in the table above are anchored on the MacBook. Document this clearly when the bench
  workflow lands.
