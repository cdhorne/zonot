// @zonot/worker — Cloudflare Worker entry point (worker-spec / ADR-0035).
//
// One root middleware: assign a trace id, run the router, and translate any
// thrown error into an RFC 9457 problem. Every response carries zonot-trace-id;
// every request emits one content-free structured log line on completion.
//
// Phase 1(a) lands the middleware + dispatch + observability spine. The MCP +
// HTTP route table (1(e)) and `init` (1(f)) plug into `route()` next.

import type { ExecutionContext } from '@cloudflare/workers-types';
import { NotFoundError } from '@zonot/core/errors';
import type { Env } from './env.ts';
import { handleHttp } from './http.ts';
import { logRequest } from './log.ts';
import { handleMcp } from './mcp.ts';
import { isServerError, problemResponse, toZonotProblem } from './problem.ts';
import { newTraceId, withTraceHeader } from './trace.ts';

export default {
  async fetch(request: Request, env: Env, _execCtx: ExecutionContext): Promise<Response> {
    const trace_id = newTraceId();
    const startedAt = Date.now();
    const url = new URL(request.url);

    try {
      const res = await route(request, env, trace_id);
      logRequest({
        trace_id,
        workspace_hash: null,
        op: null,
        method: request.method,
        path_shape: pathShape(url.pathname),
        status: res.status,
        latency_ms: Date.now() - startedAt,
        error_type: null,
      });
      return withTraceHeader(res, trace_id);
    } catch (err) {
      const problem = toZonotProblem(err, trace_id);
      if (isServerError(problem)) {
        // 1(e) wires Sentry.captureException here (content-stripped; §2.3).
        console.error(JSON.stringify({ trace_id, level: 'error', error_type: problem.title }));
      }
      logRequest({
        trace_id,
        workspace_hash: null,
        op: null,
        method: request.method,
        path_shape: pathShape(url.pathname),
        status: problem.status,
        latency_ms: Date.now() - startedAt,
        error_type: problem.title,
      });
      return problemResponse(problem);
    }
  },
};

/** Route table: health probe, the MCP transport (agent), the HTTP transport (app). */
async function route(request: Request, env: Env, trace_id: string): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/healthz') {
    return Response.json({ status: 'ok', service: 'zonot-worker' });
  }

  // MCP transport (Claude-as-agent): /v1/{workspace}/{secret}/mcp — all methods.
  if (url.pathname.startsWith('/v1/') && url.pathname.endsWith('/mcp')) {
    return handleMcp(request, env, trace_id);
  }

  // HTTP transport (app + integrators).
  if (url.pathname.startsWith('/v1/')) {
    return handleHttp(request, env, trace_id);
  }

  throw new NotFoundError(`route ${request.method} ${url.pathname}`);
}

/** Collapse the workspace, path-secret, and ids to a template so logs leak nothing. */
function pathShape(pathname: string): string {
  return pathname
    .replace(/^\/v1\/[^/]+\/[^/]+/, '/v1/:workspace/:secret')
    .replace(/\/[0-9A-HJKMNP-TV-Z]{26}(?:-[^/]*)?/g, '/:id');
}
