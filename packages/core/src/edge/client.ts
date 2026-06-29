// WorkerClient — the HTTP client the app (and the CLI's future --worker mode)
// uses to ride the edge (ADR-0010). Posts the write ops to the Worker's path-
// secret endpoints and classifies the response into a sync outcome per
// mobile-spec §3.2. Web-standard (fetch) — no RN/Node specifics, so it lives in
// the kernel and stays testable with a mocked fetch.

import type { WriteResult } from '../schema/index.ts';

/** RFC 9457 problem the Worker returns on non-2xx (worker-spec §1.1). */
export interface ZonotProblem {
  type: string;
  title: string;
  status: number;
  detail: string;
  trace_id?: string;
  retryable?: boolean;
  retry_after?: number;
  sha_expected?: string;
  sha_actual?: string | null;
}

export type WriteOp = 'capture' | 'append' | 'correct' | 'undo' | 'delete';

export interface SendRequest {
  op: WriteOp;
  /** Note id — required for append/correct/undo/delete; ignored for capture. */
  id?: string;
  /** The op's request body (the schema shape, minus workspace/secret in the URL). */
  payload: unknown;
  idempotencyKey?: string;
}

export type SendOutcome =
  | { kind: 'synced'; result: WriteResult }
  | { kind: 'conflict'; problem: ZonotProblem } // 412 → refetch SHA + reapply (correction)
  | { kind: 'permanent'; problem: ZonotProblem } // 4xx the caller can't retry its way out of
  | { kind: 'retry'; retryAfter?: number; problem?: ZonotProblem }; // 5xx / 429 / network

export interface WorkerClientConfig {
  /** Path-secret prefix, e.g. https://host/v1/personal/<secret> (mobile-spec §9). */
  endpoint: string;
  fetch?: typeof fetch;
}

export class WorkerClient {
  readonly #endpoint: string;
  readonly #fetch: typeof fetch;

  constructor(config: WorkerClientConfig) {
    this.#endpoint = config.endpoint.replace(/\/$/, '');
    this.#fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async send(req: SendRequest): Promise<SendOutcome> {
    const { method, path } = route(req);
    let res: Response;
    try {
      res = await this.#fetch(`${this.#endpoint}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(req.idempotencyKey ? { 'idempotency-key': req.idempotencyKey } : {}),
        },
        ...(method === 'DELETE' && req.payload === undefined
          ? {}
          : { body: JSON.stringify(req.payload ?? {}) }),
      });
    } catch {
      return { kind: 'retry' }; // network failure — backoff + retry (§3.2)
    }

    if (res.ok) return { kind: 'synced', result: (await res.json()) as WriteResult };

    const problem = await readProblem(res);
    if (res.status === 412) return { kind: 'conflict', problem };
    if (res.status === 429 || res.status >= 500) {
      const ra = retryAfter(res);
      return { kind: 'retry', problem, ...(ra !== undefined ? { retryAfter: ra } : {}) };
    }
    return { kind: 'permanent', problem };
  }
}

function route(req: SendRequest): { method: string; path: string } {
  switch (req.op) {
    case 'capture':
      return { method: 'POST', path: '/capture' };
    case 'append':
      return { method: 'POST', path: `/notes/${req.id}/append` };
    case 'correct':
      return { method: 'POST', path: `/notes/${req.id}/correct` };
    case 'undo':
      return { method: 'POST', path: `/notes/${req.id}/undo` };
    case 'delete':
      return { method: 'DELETE', path: `/notes/${req.id}` };
  }
}

async function readProblem(res: Response): Promise<ZonotProblem> {
  try {
    return (await res.json()) as ZonotProblem;
  } catch {
    return { type: 'about:blank', title: 'error', status: res.status, detail: res.statusText };
  }
}

function retryAfter(res: Response): number | undefined {
  const h = res.headers.get('retry-after');
  if (!h) return undefined;
  const n = Number(h);
  if (Number.isFinite(n)) return n; // delta-seconds form
  const date = Date.parse(h); // HTTP-date form
  if (!Number.isNaN(date)) return Math.max(0, Math.round((date - Date.now()) / 1000));
  return undefined;
}
