// MCP transport (ADR-0022). The agent (Claude) captures/reads through this.
//
// Stateless + Durable-Object-free via the SDK's web-standard Streamable HTTP
// transport (sessionIdGenerator: undefined) — the same web-standard transport
// Cloudflare's createMcpHandler wraps, used directly so the Worker carries no
// `agents` dependency and stays vendor-neutral (ADR-0028 edge-portability).
// A fresh McpServer + transport are built per request (SDK 1.26+ rule: never
// share a server/transport across clients). Tool logic lives in mcp-tools.ts.
//
// Endpoint: /v1/{workspace}/{secret}/mcp  (path-secret auth, same as HTTP).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { Env } from './env.ts';
import { mcpTools } from './mcp-tools.ts';
import { dispatchWorkspace } from './workspace.ts';

/** A new McpServer bound to one authenticated workspace (fresh per request). */
export function buildServer(workspaceCtx: Parameters<typeof mcpTools>[0], env: Env): McpServer {
  const server = new McpServer({ name: 'zonot', version: '0.0.0' });
  for (const tool of mcpTools(workspaceCtx, env)) {
    server.tool(tool.name, tool.description, tool.shape, (args: Record<string, unknown>) =>
      tool.handler(args),
    );
  }
  return server;
}

export async function handleMcp(request: Request, env: Env, trace_id: string): Promise<Response> {
  // /v1/{workspace}/{secret}/mcp — authenticate before any tool runs.
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  const [, workspaceRaw, secret] = parts;
  const ctx = await dispatchWorkspace(
    decodeURIComponent(workspaceRaw ?? ''),
    secret ?? null,
    env,
    trace_id,
  );

  const server = buildServer(ctx, env);
  // No sessionIdGenerator → stateless mode (SDK: "if not provided, session
  // management is disabled"), which is what a per-request Worker needs.
  const transport = new WebStandardStreamableHTTPServerTransport({});
  await server.connect(transport);
  return transport.handleRequest(request);
}
