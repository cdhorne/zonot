# @zonot/worker

The Cloudflare Worker — MCP tool surface + HTTP endpoints; the live-dogfood harness and the
path v1 mobile writes ride.

Surface (per [`docs/specs/worker-spec.md`](../../docs/specs/worker-spec.md)):

- One handler set, two transports (MCP via `createMcpHandler`; HTTP for the app).
- GitHub REST write backend (Contents / Git Data tree).
- RFC 9457 error discipline + `zonot-trace-id` header.
- Workspace dispatch + per-tenant rate limiter.
- Structured logs (Logpush) + Workers Analytics Engine metrics + Sentry from v1.0.

Anchored by [ADR-0013](../../docs/adr/0013-phase-1-deployment.md) and
[ADR-0035](../../docs/adr/0035-worker-runtime-discipline.md). Phase 1 in the build order.

## HTTP surface (v1.0)

Path-secret auth (ADR-0013) — `{secret}` is the workspace's `path_secret` from the workspace map:

| Method | Path | Op |
|--------|------|----|
| `POST` | `/v1/{workspace}/{secret}/capture` | capture (body: `{ output, raw?, thread? }`) |
| `POST` | `/v1/{workspace}/{secret}/init` | scaffold the workspace |
| `GET`  | `/v1/{workspace}/{secret}/notes?since=&limit=` | list_recent |
| `GET`  | `/v1/{workspace}/{secret}/tags?prefix=` | list_tags |
| `GET`  | `/v1/{workspace}/{secret}/notes/{id}?include_source=1` | read_note |
| `DELETE` | `/v1/{workspace}/{secret}/notes/{id}` | delete |
| `POST` | `/v1/{workspace}/{secret}/notes/{id}/append` | append (body: `{ block, base_sha }`) |
| `POST` | `/v1/{workspace}/{secret}/notes/{id}/correct` | correct (body: `{ output, base_sha }`) |
| `POST` | `/v1/{workspace}/{secret}/notes/{id}/undo` | undo |

Writes accept an `Idempotency-Key` header (core-spec §3.4). Errors are RFC 9457
`application/problem+json`; every response carries `zonot-trace-id`.

## MCP transport (Claude-as-agent)

Stateless, Durable-Object-free, via the MCP SDK's web-standard Streamable HTTP
transport (the same transport `createMcpHandler` wraps — used directly so the
Worker carries no `agents` dependency; ADR-0022 / ADR-0028).

- **Endpoint:** `/v1/{workspace}/{secret}/mcp` (same path-secret auth as HTTP).
- **Tools:** `capture`, `append`, `correct`, `undo`, `delete`, `read_note`,
  `list_recent`, `list_tags`, `init` — the workspace is never a tool argument
  (it comes from the authenticated URL).

Point an MCP client (e.g. Claude) at the endpoint:

```jsonc
// claude_desktop_config.json (or any MCP client)
{ "mcpServers": { "zonot": { "url": "https://<your-worker>/v1/personal/<secret>/mcp" } } }
```

> **Deploy smoke test (owner-run):** unit + runtime construction are covered by
> `bun test`, but the full streamable-HTTP round trip is only exercised against a
> live Worker. After `wrangler deploy`, connect an MCP client and call `init`
> then `capture`, and confirm the note lands in your repo.

## Local dev + deploy

```bash
bun test                        # unit + end-to-end (against an in-memory Git Data fake)
wrangler dev                    # local Worker; needs the secrets below

# one-time setup against your Cloudflare account:
wrangler kv namespace create IDEMPOTENCY    # paste the id into wrangler.toml
wrangler secret put WORKSPACE_MAP_JSON      # {"personal":{"owner":"you","repo":"notes","token":"ghp_…","path_secret":"…"}}
#   token = a fine-grained PAT scoped to the notes repo (Contents: read/write)

wrangler deploy --var RELEASE_SHA:$(git rev-parse HEAD)
```

After deploy, smoke-test:

```bash
curl -s https://<your-worker>/v1/personal/<secret>/init -X POST
curl -s https://<your-worker>/v1/personal/<secret>/capture \
  -X POST -H 'content-type: application/json' \
  -d '{"output":{"title":"hello","tags":["zonot"],"body":"first capture"}}'
```
