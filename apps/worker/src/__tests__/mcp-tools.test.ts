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
  resolution: { owner: 'cdhorne', repo: 'zonot-notes', token: 'ghp_x', path_secret: 's' },
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
    const names = mcpTools(ctx, env).map((t) => t.name);
    expect(names).toEqual([
      'capture',
      'append',
      'correct',
      'undo',
      'delete',
      'read_note',
      'list_recent',
      'list_tags',
      'init',
    ]);
    for (const t of mcpTools(ctx, env)) {
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
    const err = JSON.parse(res.content[0]?.text ?? '{}') as { error: string };
    expect(err.error).toBe('NotFoundError');
  });

  test('validation failure also surfaces as isError (missing body)', async () => {
    const res = await call('capture', { output: { tags: ['x'] } });
    expect(res.isError).toBe(true);
    const err = JSON.parse(res.content[0]?.text ?? '{}') as { error: string };
    expect(err.error).toBe('ValidationError');
  });
});
