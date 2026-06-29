// Single-screen onboarding (mobile-spec §6.6 / §9). Enter the Worker URL (the
// path-secret prefix, ADR-0013) + workspace, test the connection, then connect.
// The URL is stored only in expo-secure-store. (Clipboard paste + the
// list_workspaces dropdown are follow-up polish.)

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Box, Text, useTheme } from '@/design/components';
import { useWorkspace } from '@/state/workspace';

type Probe = 'idle' | 'testing' | 'ok' | 'failed';

export default function Onboarding() {
  const theme = useTheme();
  const router = useRouter();
  const connect = useWorkspace((s) => s.connect);
  const [url, setUrl] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [probe, setProbe] = useState<Probe>('idle');

  const endpoint = url.trim().replace(/\/$/, '');
  const canTest = endpoint !== '' && workspace.trim() !== '';

  async function testConnection() {
    setProbe('testing');
    try {
      const res = await fetch(`${endpoint}/tags`, { method: 'GET' });
      setProbe(res.ok ? 'ok' : 'failed');
    } catch {
      setProbe('failed');
    }
  }

  async function onConnect() {
    await connect(workspace.trim(), endpoint);
    router.replace('/(tabs)/capture');
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: theme.borderRadii.md,
    padding: theme.spacing.cozy,
    color: theme.colors.textPrimary,
    fontSize: 16,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <Box flex={1} padding="default" gap="default" justifyContent="center">
        <Text variant="display" color="textPrimary">
          Connect Zonot
        </Text>
        <Text variant="bodySmall" color="textMuted">
          Point the app at your Worker. Your notes land as plain Markdown in your own repo.
        </Text>

        <Box gap="tight">
          <Text variant="bodySmall" color="textSubtle">
            Worker URL
          </Text>
          <TextInput
            value={url}
            onChangeText={(t) => {
              setUrl(t);
              setProbe('idle');
            }}
            placeholder="https://…/v1/workspace/secret"
            placeholderTextColor={theme.colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />
        </Box>

        <Box gap="tight">
          <Text variant="bodySmall" color="textSubtle">
            Workspace
          </Text>
          <TextInput
            value={workspace}
            onChangeText={setWorkspace}
            placeholder="personal"
            placeholderTextColor={theme.colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />
        </Box>

        {probe === 'ok' ? (
          <Text variant="bodySmall" color="statusSuccess">
            Connection OK.
          </Text>
        ) : probe === 'failed' ? (
          <Text variant="bodySmall" color="statusDanger">
            Could not reach the Worker. Check the URL and secret.
          </Text>
        ) : null}

        <Box gap="cozy">
          <Button
            label={probe === 'testing' ? 'Testing…' : 'Test connection'}
            variant="secondary"
            onPress={testConnection}
            disabled={!canTest || probe === 'testing'}
          />
          <Button label="Connect" onPress={onConnect} disabled={probe !== 'ok'} />
        </Box>
      </Box>
    </SafeAreaView>
  );
}
