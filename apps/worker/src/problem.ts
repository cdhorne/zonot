// RFC 9457 error discipline (worker-spec §1 / ADR-0035). Every non-2xx response
// is application/problem+json carrying a zonot-trace-id. Core typed errors are
// translated here — one switch on the error name, never bespoke shapes.

const PROBLEM_BASE = 'https://zonot.app/problems';

export interface ZonotProblem {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  trace_id: string;
  retryable?: boolean;
  retry_after?: number;
  errors?: Array<{ path: string; message: string }>;
  sha_expected?: string;
  sha_actual?: string | null;
}

// name → { httpStatus, type-URI slug, title }. Mirrors worker-spec §1.2.
const TAXONOMY: Record<string, { status: number; slug: string; title: string }> = {
  SHAConflictError: { status: 412, slug: 'sha-conflict', title: 'SHA conflict' },
  IdempotencyReplayError: { status: 422, slug: 'idempotency-replay', title: 'Idempotency replay' },
  WorkspaceNotInitializedError: {
    status: 409,
    slug: 'uninitialized',
    title: 'Workspace not initialized',
  },
  NotFoundError: { status: 404, slug: 'not-found', title: 'Not found' },
  NoteFileParseError: { status: 500, slug: 'internal', title: 'Internal error' },
  UnauthorizedError: { status: 401, slug: 'unauthorized', title: 'Unauthorized' },
  EntitlementInactiveError: {
    status: 403,
    slug: 'entitlement-inactive',
    title: 'Entitlement inactive',
  },
  RateLimitedError: { status: 429, slug: 'rate-limited', title: 'Rate limited' },
  UpstreamRateLimitedError: {
    status: 429,
    slug: 'upstream-rate-limited',
    title: 'Upstream rate limited',
  },
  UpstreamDownError: { status: 502, slug: 'upstream-down', title: 'Upstream unavailable' },
  ValidationError: { status: 400, slug: 'validation', title: 'Validation failed' },
};

const INTERNAL = { status: 500, slug: 'internal', title: 'Internal error' };

/** Translate any thrown value into an RFC 9457 problem. */
export function toZonotProblem(err: unknown, trace_id: string): ZonotProblem {
  const e = err as { name?: string; message?: string } & Record<string, unknown>;
  const entry = (e?.name && TAXONOMY[e.name]) || INTERNAL;

  const problem: ZonotProblem = {
    type: `${PROBLEM_BASE}/${entry.slug}`,
    title: entry.title,
    status: entry.status,
    // 5xx must not leak internals to the caller — the trace id is the handle.
    detail: entry.status >= 500 ? 'an internal error occurred' : (e?.message ?? entry.title),
    trace_id,
  };

  switch (e?.name) {
    case 'SHAConflictError':
      problem.sha_expected = e.shaExpected as string;
      problem.sha_actual = (e.shaActual as string | null) ?? null;
      break;
    case 'RateLimitedError':
    case 'UpstreamRateLimitedError':
      problem.retryable = true;
      problem.retry_after = e.retryAfterSeconds as number;
      break;
    case 'UpstreamDownError':
      problem.retryable = true;
      break;
    case 'ValidationError':
      problem.errors = e.issues as Array<{ path: string; message: string }>;
      break;
  }

  return problem;
}

/** Whether this error maps to a 5xx (→ Sentry + content-free detail). */
export function isServerError(problem: ZonotProblem): boolean {
  return problem.status >= 500;
}

export function problemResponse(problem: ZonotProblem): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/problem+json',
    'zonot-trace-id': problem.trace_id,
  };
  if (problem.retry_after !== undefined) headers['retry-after'] = String(problem.retry_after);
  return new Response(JSON.stringify(problem), { status: problem.status, headers });
}
