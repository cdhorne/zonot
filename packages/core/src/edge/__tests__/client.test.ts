import { describe, expect, test } from 'bun:test';
import { type SendRequest, WorkerClient } from '../client.ts';

const ENDPOINT = 'https://host/v1/personal/s3cr3t';

function clientReturning(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchStub = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: url.toString(), init: init ?? {} });
    return handler(url.toString(), init ?? {});
  }) as unknown as typeof fetch;
  return { client: new WorkerClient({ endpoint: ENDPOINT, fetch: fetchStub }), calls };
}

const json = (value: unknown, status: number) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

const writeResult = {
  id: '01H',
  path: 'notes/x.md',
  commit_sha: 'abc',
  applied_tags: [],
  capture_id: '01H',
};
const cap: SendRequest = {
  op: 'capture',
  payload: { output: { body: 'hi' } },
  idempotencyKey: 'k1',
};

describe('WorkerClient.send', () => {
  test('2xx → synced with the WriteResult; sends Idempotency-Key', async () => {
    const { client, calls } = clientReturning(() => json(writeResult, 201));
    const out = await client.send(cap);
    expect(out.kind).toBe('synced');
    expect(out.kind === 'synced' && out.result.id).toBe('01H');
    expect(calls[0]?.url).toBe(`${ENDPOINT}/capture`);
    expect((calls[0]?.init.headers as Record<string, string>)['idempotency-key']).toBe('k1');
  });

  test('routes each op to the right method + path', async () => {
    const { client, calls } = clientReturning(() => json(writeResult, 200));
    await client.send({ op: 'append', id: '01H', payload: {} });
    await client.send({ op: 'delete', id: '01H', payload: undefined });
    expect(calls[0]?.url).toBe(`${ENDPOINT}/notes/01H/append`);
    expect(calls[1]).toMatchObject({ url: `${ENDPOINT}/notes/01H` });
    expect(calls[1]?.init.method).toBe('DELETE');
  });

  test('412 → conflict (correction path)', async () => {
    const { client } = clientReturning(() =>
      json({ type: 't', title: 'c', status: 412, detail: 'sha' }, 412),
    );
    expect((await client.send(cap)).kind).toBe('conflict');
  });

  test('422 / other 4xx → permanent', async () => {
    const { client } = clientReturning(() =>
      json({ type: 't', title: 'x', status: 422, detail: 'replay' }, 422),
    );
    expect((await client.send(cap)).kind).toBe('permanent');
  });

  test('5xx → retry, echoing Retry-After', async () => {
    const { client } = clientReturning(
      () => new Response('{}', { status: 503, headers: { 'retry-after': '8' } }),
    );
    const out = await client.send(cap);
    expect(out).toMatchObject({ kind: 'retry', retryAfter: 8 });
  });

  test('network failure → retry', async () => {
    const { client } = clientReturning(() => {
      throw new Error('offline');
    });
    expect((await client.send(cap)).kind).toBe('retry');
  });
});
