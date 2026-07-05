// GitHub credential seam (managed-spec §4 / §7; ADR-0017). One interface, two
// implementations: the v1.0 static PAT from the workspace map (below), and the
// v1.1 GitHub App per-request installation-token minting (task 4(b) — App JWT
// → POST /app/installations/{id}/access_tokens, ≤1h, request-lifetime only,
// never cached in KV).

import type { WorkspaceContext } from './env.ts';

/** Yields the GitHub token a request's write/read backend should use. */
export interface TokenProvider {
  getToken(ctx: WorkspaceContext): Promise<string>;
}

/** v1.0 / self-host: the fine-grained PAT carried in the static workspace map. */
export const staticPatTokenProvider: TokenProvider = {
  getToken: (ctx) => Promise.resolve(ctx.resolution.token),
};
