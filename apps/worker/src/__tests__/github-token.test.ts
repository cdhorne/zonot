import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { UpstreamDownError } from '@zonot/core/errors';
import type { Env, WorkspaceContext } from '../env.ts';
import { getGitHubToken, githubAppConfig, mintInstallationToken } from '../github-token.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const RSA = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

async function generateAppKey() {
  const pair = (await crypto.subtle.generateKey(
    { ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const b64 = btoa(String.fromCharCode(...der));
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----\n`;
  return { pem, publicKey: pair.publicKey };
}

let keyA: Awaited<ReturnType<typeof generateAppKey>>;
let keyB: Awaited<ReturnType<typeof generateAppKey>>;
beforeAll(async () => {
  keyA = await generateAppKey();
  keyB = await generateAppKey();
});

function b64urlDecode(part: string): Uint8Array {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')), (c) =>
    c.charCodeAt(0),
  );
}

async function verifyJwt(jwt: string, publicKey: CryptoKey) {
  const [header, payload, signature] = jwt.split('.') as [string, string, string];
  const valid = await crypto.subtle.verify(
    RSA.name,
    publicKey,
    b64urlDecode(signature),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const decode = (p: string) => JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
  return { valid, header: decode(header), payload: decode(payload) };
}

/** Stub GitHub's token endpoint; returns the JWTs it saw. */
function stubTokenEndpoint(respond: (jwt: string, call: number) => Response) {
  const jwts: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe('https://gh.test/app/installations/87654321/access_tokens');
    expect(init?.method).toBe('POST');
    const jwt = String((init?.headers as Record<string, string>).authorization).replace(
      'Bearer ',
      '',
    );
    jwts.push(jwt);
    return respond(jwt, jwts.length);
  }) as typeof fetch;
  return jwts;
}

const appCtx: WorkspaceContext = {
  workspace: 'personal',
  workspace_hash: 'sha256:test',
  resolution: {
    owner: 'cdhorne',
    repo: 'zonot-notes',
    credential: { kind: 'app', installation_id: 87654321 },
  },
  trace_id: '01HZZZA1B2C3D4E5F6G7H8J9K0',
};

describe('getGitHubToken', () => {
  test('pat credential → the static token, no network', async () => {
    const ctx: WorkspaceContext = {
      ...appCtx,
      resolution: { ...appCtx.resolution, credential: { kind: 'pat', token: 'ghp_x' } },
    };
    expect(await getGitHubToken(ctx, { WORKSPACE_MAP_JSON: '{}' })).toBe('ghp_x');
  });

  test('app credential without App secrets → operator misconfig error', async () => {
    await expect(getGitHubToken(appCtx, { WORKSPACE_MAP_JSON: '{}' })).rejects.toThrow(
      /GITHUB_APP_\* is not configured/,
    );
  });

  test('app credential mints via the configured App', async () => {
    stubTokenEndpoint(() => Response.json({ token: 'ghs_minted' }, { status: 201 }));
    const env: Env = {
      WORKSPACE_MAP_JSON: '{}',
      GITHUB_APP_ID: '12345',
      GITHUB_APP_PRIVATE_KEY: keyA.pem,
    };
    expect(await getGitHubToken(appCtx, env, 'https://gh.test')).toBe('ghs_minted');
  });
});

describe('githubAppConfig', () => {
  test('orders keys current-first with the rotation-overlap key second', () => {
    const env: Env = {
      WORKSPACE_MAP_JSON: '{}',
      GITHUB_APP_ID: '12345',
      GITHUB_APP_PRIVATE_KEY: 'current',
      GITHUB_APP_PRIVATE_KEY_PREVIOUS: 'previous',
    };
    expect(githubAppConfig(env)?.privateKeys).toEqual(['current', 'previous']);
    expect(githubAppConfig({ WORKSPACE_MAP_JSON: '{}' })).toBeNull();
  });
});

describe('mintInstallationToken', () => {
  test('signs a spec-shaped App JWT (RS256, iss, 60s backdate, 9-min expiry)', async () => {
    const jwts = stubTokenEndpoint(() => Response.json({ token: 'ghs_ok' }, { status: 201 }));
    const before = Math.floor(Date.now() / 1000);
    const token = await mintInstallationToken(
      { appId: '12345', privateKeys: [keyA.pem] },
      87654321,
      'https://gh.test',
    );
    expect(token).toBe('ghs_ok');

    const { valid, header, payload } = await verifyJwt(jwts[0] as string, keyA.publicKey);
    expect(valid).toBe(true);
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(payload.iss).toBe('12345');
    expect(payload.iat).toBeGreaterThanOrEqual(before - 61);
    expect(payload.iat).toBeLessThanOrEqual(before - 58);
    expect(payload.exp - payload.iat).toBe(600);
  });

  test('401 on the current key retries with the previous key (rotation overlap)', async () => {
    const jwts = stubTokenEndpoint((_jwt, call) =>
      call === 1
        ? Response.json({ message: 'bad credentials' }, { status: 401 })
        : Response.json({ token: 'ghs_previous' }, { status: 201 }),
    );
    const token = await mintInstallationToken(
      { appId: '12345', privateKeys: [keyA.pem, keyB.pem] },
      87654321,
      'https://gh.test',
    );
    expect(token).toBe('ghs_previous');
    expect((await verifyJwt(jwts[0] as string, keyA.publicKey)).valid).toBe(true);
    expect((await verifyJwt(jwts[1] as string, keyB.publicKey)).valid).toBe(true);
  });

  test('401 on every key → terminal error, no infinite retry', async () => {
    const jwts = stubTokenEndpoint(() =>
      Response.json({ message: 'bad credentials' }, { status: 401 }),
    );
    await expect(
      mintInstallationToken(
        { appId: '12345', privateKeys: [keyA.pem, keyB.pem] },
        87654321,
        'https://gh.test',
      ),
    ).rejects.toThrow(/status 401/);
    expect(jwts.length).toBe(2);
  });

  test('404 (installation revoked) → terminal error without key fallback', async () => {
    const jwts = stubTokenEndpoint(() => Response.json({ message: 'nope' }, { status: 404 }));
    await expect(
      mintInstallationToken(
        { appId: '12345', privateKeys: [keyA.pem, keyB.pem] },
        87654321,
        'https://gh.test',
      ),
    ).rejects.toThrow(/status 404/);
    expect(jwts.length).toBe(1);
  });

  test('GitHub 5xx → UpstreamDownError (retryable surface)', async () => {
    stubTokenEndpoint(() => Response.json({ message: 'down' }, { status: 503 }));
    await expect(
      mintInstallationToken(
        { appId: '12345', privateKeys: [keyA.pem] },
        87654321,
        'https://gh.test',
      ),
    ).rejects.toBeInstanceOf(UpstreamDownError);
  });

  test('PKCS#1 key → clear conversion guidance, before any network call', async () => {
    globalThis.fetch = (() => {
      throw new Error('unexpected network call');
    }) as unknown as typeof fetch;
    await expect(
      mintInstallationToken(
        {
          appId: '12345',
          privateKeys: ['-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----'],
        },
        87654321,
        'https://gh.test',
      ),
    ).rejects.toThrow(/openssl pkcs8/);
  });
});
