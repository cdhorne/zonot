import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
// Reuse the core backend's in-memory Git Data fake (test-only deep import).
import { FakeGitHub } from '../../../../packages/core/src/write-client/__tests__/fake-github.ts';
import type { Env, WorkspaceContext } from '../env.ts';
import { mcpTools, type ToolDef } from '../mcp-tools.ts';

const realFetch = globalThis.fetch;
let gh: FakeGitHub;

const ctx: WorkspaceContext = {
  workspace: 'personal',
  workspace_hash: 'sha256:test',
  resolution: {
    owner: 'cdhorne',
    repo: 'zonot-notes',
    credential: { kind: 'pat', token: 'ghp_x' },
  },
  trace_id: '01HZZZA1B2C3D4E5F6G7H8J9K0',
};
const env: Env = { WORKSPACE_MAP_JSON: '{}' };

function tool(name: string): ToolDef {
  const t = mcpTools(ctx, env).find((x) => x.name === name);
  if (!t) throw new Error(`no tool ${name}`);
  return t;
}

async function call(name: string, args: Record<string, unknown>) {
  return tool(name).handler(args);
}

beforeEach(() => {
  gh = new FakeGitHub();
  globalThis.fetch = gh.fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('mcpTools', () => {
  test('exposes the v1.0 tool surface, workspace never an argument', () => {
    const tools = mcpTools(ctx, env);
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'append',
        'capture',
        'correct',
        'delete',
        'init',
        'list_recent',
        'list_tags',
        'read_note',
        'undo',
      ].sort(),
    );
    for (const t of tools) {
      expect(Object.keys(t.shape)).not.toContain('workspace');
    }
  });

  test('capture tool writes a note and returns its result', async () => {
    const res = await call('capture', { output: { title: 'Via MCP', tags: ['x'], body: 'hi' } });
    expect(res.isError).toBeUndefined();
    const data = JSON.parse(res.content[0]?.text ?? '{}') as { id: string; applied_tags: string[] };
    expect(data.applied_tags).toEqual(['x']);

    const read = await call('read_note', { id: data.id });
    const note = JSON.parse(read.content[0]?.text ?? '{}') as { frontmatter: { title: string } };
    expect(note.frontmatter.title).toBe('Via MCP');
  });

  test('a handler error becomes an MCP isError result (not a throw)', async () => {
    // Seed a note so the repo has a head, then append to a different (missing) id.
    await call('capture', { output: { body: 'seed' } });
    const res = await call('append', {
      id: '01HZZZA1B2C3D4E5F6G7H8J9ZZ',
      block: '- x',
      base_sha: 'deadbeef',
    });
    expect(res.isError).toBe(true);
    // Errors are RFC 9457 problems (redacted, trace-carrying), not raw messages.
    const p = JSON.parse(res.content[0]?.text ?? '{}') as {
      status: number;
      type: string;
      trace_id: string;
    };
    expect(p.status).toBe(404);
    expect(p.type).toContain('not-found');
    expect(p.trace_id).toBe(ctx.trace_id);
  });

  test('validation failure also surfaces as isError (missing body)', async () => {
    const res = await call('capture', { output: { tags: ['x'] } });
    expect(res.isError).toBe(true);
    const p = JSON.parse(res.content[0]?.text ?? '{}') as { status: number };
    expect(p.status).toBe(400);
  });
});
