import { describe, expect, test } from 'bun:test';
import type { Env, WorkspaceContext } from '../env.ts';
import { buildServer } from '../mcp.ts';

// Runtime smoke test: constructing the McpServer exercises the SDK import paths
// and McpServer.tool() against our zod-4 raw shapes — the integration points
// that can't be checked by types alone. Full streamable-HTTP behavior is
// verified at deploy (see apps/worker/README.md MCP smoke test).

const ctx: WorkspaceContext = {
  workspace: 'personal',
  workspace_hash: 'sha256:test',
  resolution: { owner: 'cdhorne', repo: 'zonot-notes', token: 'ghp_x', path_secret: 's' },
  trace_id: '01HZZZA1B2C3D4E5F6G7H8J9K0',
};
const env: Env = { WORKSPACE_MAP_JSON: '{}' };

describe('buildServer', () => {
  test('registers the tool set on an McpServer without throwing', () => {
    const server = buildServer(ctx, env);
    expect(server).toBeDefined();
    // The SDK exposes a server.server (the underlying Server); presence is enough
    // to confirm construction + tool registration succeeded against zod-4 shapes.
    expect((server as { server?: unknown }).server).toBeDefined();
  });
});
