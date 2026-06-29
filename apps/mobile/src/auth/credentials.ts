// Credential storage (mobile-spec §9.3). The Worker endpoint embeds the
// path-secret, so it lives in expo-secure-store (Keychain/Keystore) — never
// AsyncStorage, never logged. Keys are versioned (the "never delete old keys"
// discipline) so a v1.1 migration to OAuth token storage stays clean. No GitHub
// PAT ever reaches the device (it's a Worker secret, ADR-0013).

import * as SecureStore from 'expo-secure-store';

const KEY_VERSION = 1;

export interface Credentials {
  /** Path-secret prefix, e.g. https://host/v1/<workspace>/<secret>. */
  endpoint: string;
  workspace: string;
}

function endpointKey(workspace: string): string {
  return `zonot.worker_url.v${KEY_VERSION}.${workspace}`;
}

export async function saveCredentials(c: Credentials): Promise<void> {
  await SecureStore.setItemAsync(endpointKey(c.workspace), c.endpoint);
}

export async function loadCredentials(workspace: string): Promise<Credentials | null> {
  const endpoint = await SecureStore.getItemAsync(endpointKey(workspace));
  return endpoint ? { endpoint, workspace } : null;
}

export async function clearCredentials(workspace: string): Promise<void> {
  await SecureStore.deleteItemAsync(endpointKey(workspace));
}
