// GitHub credential resolution (managed-spec §4 / §7; ADR-0017). One entry
// point over the credential union: static PATs pass through (v1.0 /
// self-host); App installations mint a short-lived installation token per
// request — App JWT (RS256, ≤10 min) → POST /app/installations/{id}/
// access_tokens (≤1h). The token lives for the request only: never KV,
// never logs (ADR-0037).

import { UpstreamDownError } from '@zonot/core/errors';
import type { Env, WorkspaceContext } from './env.ts';

const GITHUB_API = 'https://api.github.com';

/** Resolve the GitHub token for this request's backend. */
export async function getGitHubToken(
  ctx: WorkspaceContext,
  env: Env,
  githubApiBase: string = GITHUB_API,
): Promise<string> {
  const credential = ctx.resolution.credential;
  if (credential.kind === 'pat') return credential.token;

  const app = githubAppConfig(env);
  if (!app) {
    // Operator misconfiguration (an app-credential workspace on a deployment
    // without App secrets) — not a caller error, so a plain 500.
    throw new Error('workspace uses an App credential but GITHUB_APP_* is not configured');
  }
  return mintInstallationToken(app, credential.installation_id, githubApiBase);
}

export interface GitHubAppConfig {
  appId: string;
  /** PKCS#8 PEM keys, current first; a second entry is the outgoing key kept
   *  valid through the 24h rotation overlap (ADR-0037 rotation table). */
  privateKeys: string[];
}

/** Read the App credentials from managed-deployment secrets, if present. */
export function githubAppConfig(env: Env): GitHubAppConfig | null {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) return null;
  return {
    appId: env.GITHUB_APP_ID,
    privateKeys: [
      env.GITHUB_APP_PRIVATE_KEY,
      ...(env.GITHUB_APP_PRIVATE_KEY_PREVIOUS ? [env.GITHUB_APP_PRIVATE_KEY_PREVIOUS] : []),
    ],
  };
}

/**
 * Mint an installation access token. Tries each configured key in order: a
 * 401 means GitHub rejected that key's JWT (mid-rotation), so the next key
 * gets a chance; any other failure is terminal.
 */
export async function mintInstallationToken(
  app: GitHubAppConfig,
  installationId: number,
  githubApiBase: string = GITHUB_API,
): Promise<string> {
  let lastStatus = 0;
  for (const key of app.privateKeys) {
    const jwt = await signAppJwt(app.appId, key);
    const res = await fetch(`${githubApiBase}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'zonot-worker',
      },
    });
    if (res.ok) {
      const body = (await res.json()) as { token: string };
      return body.token;
    }
    lastStatus = res.status;
    if (res.status !== 401) break;
  }
  if (lastStatus >= 500) {
    throw new UpstreamDownError(`GitHub App token endpoint returned ${lastStatus}`);
  }
  // 401 after all keys (bad/expired key) or 404 (installation revoked by the
  // user): operator/custody state the caller can't fix — a plain 500 whose
  // trace id is the support handle. Recovery is onboarding's job (4(d)).
  throw new Error(`GitHub App token minting failed with status ${lastStatus}`);
}

/** App JWT per GitHub docs: iat 60s in the past (clock drift), 9-min expiry
 *  (10-min ceiling), iss = App id, RS256. */
async function signAppJwt(appId: string, privateKeyPem: string): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64UrlEncodeJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64UrlEncodeJson({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: appId });
  const signingInput = `${header}.${payload}`;
  const key = await importPkcs8Key(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function importPkcs8Key(pem: string): Promise<CryptoKey> {
  if (pem.includes('RSA PRIVATE KEY')) {
    // GitHub downloads keys as PKCS#1; WebCrypto only imports PKCS#8.
    throw new Error(
      'GITHUB_APP_PRIVATE_KEY is PKCS#1; convert with `openssl pkcs8 -topk8 -nocrypt`',
    );
  }
  const der = Uint8Array.from(
    atob(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s/g, '')),
    (c) => c.charCodeAt(0),
  );
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}
