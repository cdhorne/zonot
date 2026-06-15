# Issue conventions

Task tracking for Zonot is **GitHub Issues with a thin convention**, adapted from
[`cdhorne/claude-autopilot`](https://github.com/cdhorne/claude-autopilot). The convention exists so
solo + multi-agent work stays coherent without leaning on a heavier tracker (Linear, Jira) or a
locking-prone markdown roadmap.

## Why GitHub Issues

- Co-located with code and PRs; `gh` CLI gives agents a uniform read/write surface
- Mobile app + notifications come free
- Native linking (`Fixes #N`) makes "in progress" observable without mutating the issue
- No lock-in: issues export as JSON, and the durable design record stays in [`docs/adr/`](../adr/) ADRs

Rejected alternatives: Linear (heavy for solo scale), markdown roadmap (merge conflicts when
parallel agents charter/ship the same file — see autopilot issue #12).

## Templates

Two templates live in [`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE/) and load
automatically when you open a new issue:

- **Feature / design** — `Problem → Design → Tradeoffs → Context`
- **Bug / task** — `Summary → Acceptance → Non-goals → Notes`

Both open with `Scope: S | M | L` on the first line. Pick one before writing the body — it forces
an upfront sizing call and lets future filtering work.

Blank issues are disabled. If neither template fits, the right move is usually an ADR in
[`docs/adr/`](../adr/), not a freeform issue.

## Scope

| Tag | Meaning | Typical shape |
| --- | --- | --- |
| `S` | One sitting, one file or one tight boundary | Bug fix, doc tweak, single helper |
| `M` | A few hours, multiple files within one package | Feature inside one runtime, schema addition |
| `L` | A day-plus, crosses package boundaries or needs a plan doc | Cross-runtime work, new extension point |

Anything bigger than `L` is a **design decision** and belongs as an ADR in [`docs/adr/`](../adr/), then
fanned out into multiple issues.

## Labels

Keep the label set small. Add labels only when they earn their keep.

- `bug` — defect against intended behavior
- `enhancement` — new capability
- `documentation` — docs-only change
- `ready` — gate for agent pickup; means "scoped, unblocked, safe to claim"

The default GitHub trio (`bug`, `enhancement`, `documentation`) is auto-applied by the templates.
`ready` is the one **load-bearing** label — agents (and humans) should treat it as the queue
signal. Adding it is a deliberate act after the issue is well-scoped.

Avoid `priority:*`, `status:*`, and milestone fields at this scale — they're tracking-overhead
without a team to coordinate.

## IDs and references

Use GitHub's native `#N`. No `ZONOT-` prefix layer — that's a project-management artifact Zonot
doesn't need. Cross-repo references use `cdhorne/zonot#N`.

Commit trailers may reference issues; the project's provenance trailer scheme
(`Source`, `Capture-Id`, `Edit-Of`, etc. — ADR-0007/0026) is for note records, not workflow.
Workflow trailers stay GitHub-idiomatic: `Fixes #N`, `Refs #N`.

## In-progress signal

**Do not mark in-progress inside the issue body** and do not commit "in-progress" markers to
the repo. This was an explicit design decision in autopilot's claim-ledger work (#12): mutating
shared state for transient signals produces merge conflicts under parallel work.

The canonical signal is:

1. **Assignee** on the issue — the human-or-agent claiming the work
2. **Draft PR linked via `Fixes #N`** — GitHub renders the linked-PR badge in the issue
3. **Branch existence** — branch name carries the issue number (`feat/42-…` or
   `fix/42-…`); branch alone is enough for short-lived work

That's the whole protocol. Closing the issue happens automatically when the PR with `Fixes #N`
merges to `main`.

### When parallel agents enter the picture

If multiple agents ever pick from the same queue concurrently, the right add-on is autopilot's
**ephemeral claim ledger** (`.dev/zonot-claims.json`, gitignored, lockfile-guarded, PID-tracked,
stale entries GC'd by liveness check). Until then, the issue's `assignees` field plus branch
existence is sufficient — solo workflow doesn't race against itself.

## Flow

```
open → triage (templates fill body, scope set)
     → mark `ready` when scoped + unblocked
     → assignee claims, branch + draft PR created
     → PR ready for review
     → merge → issue auto-closes via Fixes #N
```

Steps that should **not** mutate the issue: starting work (use assignee + branch instead),
pausing (close with a note or label `blocked`, don't leave half-edited bodies), or recording
implementation notes (those go in the PR description).

## What goes in an ADR instead

Not every decision belongs in an issue. If the work:

- Changes a non-negotiable from CLAUDE.md or an existing ADR
- Introduces a new extension point or boundary
- Picks between architectural alternatives an existing ADR hasn't already chosen

…then write the ADR first in [`docs/adr/`](../adr/) (one new file, per ADR-0014), and only
open issues for the implementation slices once the ADR is in.
