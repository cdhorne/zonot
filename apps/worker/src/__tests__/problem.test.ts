import { describe, expect, test } from 'bun:test';
import {
  NoteFileParseError,
  SHAConflictError,
  UpstreamDownError,
  UpstreamRateLimitedError,
  ValidationError,
} from '@zonot/core/errors';
import { EntitlementInactiveError } from '../entitlement.ts';
import { problemResponse, toZonotProblem } from '../problem.ts';

const TRACE = '01HZZZA1B2C3D4E5F6G7H8J9K0';

describe('toZonotProblem', () => {
  test('SHAConflictError → 412 with sha extensions', () => {
    const p = toZonotProblem(new SHAConflictError('notes/x.md', 'aaa', 'bbb'), TRACE);
    expect(p.status).toBe(412);
    expect(p.type).toBe('https://zonot.app/problems/sha-conflict');
    expect(p.sha_expected).toBe('aaa');
    expect(p.sha_actual).toBe('bbb');
    expect(p.trace_id).toBe(TRACE);
  });

  test('SHAConflictError with deleted target → sha_actual null', () => {
    const p = toZonotProblem(new SHAConflictError('notes/x.md', 'aaa', null), TRACE);
    expect(p.sha_actual).toBeNull();
  });

  test('UpstreamRateLimitedError → 429, retryable, retry_after', () => {
    const p = toZonotProblem(new UpstreamRateLimitedError(42), TRACE);
    expect(p.status).toBe(429);
    expect(p.retryable).toBe(true);
    expect(p.retry_after).toBe(42);
  });

  test('UpstreamDownError → 502, retryable, content-free detail', () => {
    const p = toZonotProblem(new UpstreamDownError('github 503: ...'), TRACE);
    expect(p.status).toBe(502);
    expect(p.retryable).toBe(true);
    expect(p.detail).toBe('an internal error occurred');
  });

  test('ValidationError → 400 with errors[]', () => {
    const issues = [{ path: 'output.body', message: 'required' }];
    const p = toZonotProblem(new ValidationError(issues), TRACE);
    expect(p.status).toBe(400);
    expect(p.errors).toEqual(issues);
  });

  test('NoteFileParseError → 500 internal, no leakage', () => {
    const p = toZonotProblem(new NoteFileParseError('notes/x.md', 'malformed YAML'), TRACE);
    expect(p.status).toBe(500);
    expect(p.type).toBe('https://zonot.app/problems/internal');
    expect(p.detail).toBe('an internal error occurred');
  });

  test('EntitlementInactiveError → 403 entitlement-inactive', () => {
    const p = toZonotProblem(new EntitlementInactiveError('personal'), TRACE);
    expect(p.status).toBe(403);
    expect(p.type).toBe('https://zonot.app/problems/entitlement-inactive');
  });

  test('unknown error → 500 internal', () => {
    const p = toZonotProblem(new Error('boom with secrets'), TRACE);
    expect(p.status).toBe(500);
    expect(p.detail).toBe('an internal error occurred');
  });
});

describe('problemResponse', () => {
  test('emits application/problem+json with the trace header', async () => {
    const res = problemResponse(toZonotProblem(new UpstreamRateLimitedError(30), TRACE));
    expect(res.status).toBe(429);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(res.headers.get('zonot-trace-id')).toBe(TRACE);
    expect(res.headers.get('retry-after')).toBe('30');
    const body = (await res.json()) as { trace_id: string };
    expect(body.trace_id).toBe(TRACE);
  });
});
