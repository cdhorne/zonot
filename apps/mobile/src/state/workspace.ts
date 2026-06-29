// Workspace / auth store (mobile-spec §9). Holds the active workspace and its
// Worker endpoint (the path-secret URL, loaded from expo-secure-store). The
// active-workspace *name* is non-sensitive and lives in AsyncStorage; the
// endpoint (with secret) only ever lives in SecureStore.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { clearCredentials, loadCredentials, saveCredentials } from '../auth/credentials.ts';
import { getMirror } from '../db/database.ts';

const ACTIVE_KEY = 'zonot.active_workspace';

export type AuthStatus = 'loading' | 'unconfigured' | 'connected';

interface WorkspaceState {
  status: AuthStatus;
  workspace: string | null;
  endpoint: string | null;
  /** Load the active workspace + its endpoint at app start. */
  hydrate: () => Promise<void>;
  /** Persist credentials after a successful onboarding connect. */
  connect: (workspace: string, endpoint: string) => Promise<void>;
  /** Forget credentials (and optionally wipe the local mirror). */
  signOut: (opts: { wipeMirror: boolean }) => Promise<void>;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  status: 'loading',
  workspace: null,
  endpoint: null,

  hydrate: async () => {
    const workspace = await AsyncStorage.getItem(ACTIVE_KEY);
    if (!workspace) {
      set({ status: 'unconfigured', workspace: null, endpoint: null });
      return;
    }
    const creds = await loadCredentials(workspace);
    if (!creds) {
      set({ status: 'unconfigured', workspace: null, endpoint: null });
      return;
    }
    set({ status: 'connected', workspace, endpoint: creds.endpoint });
  },

  connect: async (workspace, endpoint) => {
    await saveCredentials({ workspace, endpoint });
    await AsyncStorage.setItem(ACTIVE_KEY, workspace);
    set({ status: 'connected', workspace, endpoint });
  },

  signOut: async ({ wipeMirror }) => {
    const { workspace } = get();
    if (workspace) await clearCredentials(workspace);
    await AsyncStorage.removeItem(ACTIVE_KEY);
    if (wipeMirror) {
      // The mirror is derivable from the repo, so wiping is always safe.
      const mirror = getMirror();
      for (const note of mirror.listRecent({ workspace: workspace ?? '', limit: 10_000 })) {
        mirror.remove(note.id);
      }
    }
    set({ status: 'unconfigured', workspace: null, endpoint: null });
  },
}));
