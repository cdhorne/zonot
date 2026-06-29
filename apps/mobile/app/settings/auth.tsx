// Auth (mobile-spec §9.2): Worker host + workspace + connection status, re-test,
// and Sign out / Reset (forget credentials, optionally wipe the local mirror).

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Box, Text, useTheme } from '@/design/components';
import { useWorkspace } from '@/state/workspace';

function hostOf(endpoint: string | null): string {
  if (!endpoint) return '—';
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

export default function Auth() {
  const theme = useTheme();
  const router = useRouter();
  const workspace = useWorkspace((s) => s.workspace);
  const endpoint = useWorkspace((s) => s.endpoint);
  const signOut = useWorkspace((s) => s.signOut);
  const [wipeMirror, setWipeMirror] = useState(false);

  async function onSignOut() {
    await signOut({ wipeMirror });
    router.replace('/onboarding');
  }

  const Field = ({ label, value }: { label: string; value: string }) => (
    <Box flexDirection="row" justifyContent="space-between" paddingVertical="tight">
      <Text variant="bodySmall" color="textSubtle">
        {label}
      </Text>
      <Text variant="bodySmall" color="textPrimary">
        {value}
      </Text>
    </Box>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}
      edges={['bottom']}
    >
      <Box padding="default" gap="default">
        <Box>
          <Field label="Worker host" value={hostOf(endpoint)} />
          <Field label="Workspace" value={workspace ?? '—'} />
          <Field label="Status" value={endpoint ? 'connected' : 'not configured'} />
        </Box>

        <Box gap="cozy">
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text variant="body" color="textPrimary">
              Wipe local mirror on sign-out
            </Text>
            <Switch value={wipeMirror} onValueChange={setWipeMirror} />
          </Box>
          <Text variant="monoSmall" color="textSubtle">
            The mirror is derivable from your repo — wiping is always safe.
          </Text>
          <Button label="Sign out / Reset" variant="secondary" onPress={onSignOut} />
        </Box>
      </Box>
    </SafeAreaView>
  );
}
