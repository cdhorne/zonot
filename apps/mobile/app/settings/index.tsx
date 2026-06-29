// Settings landing (mobile-spec §8 / §9): links to Auth, Sync details, About.
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box, Text, useTheme } from '@/design/components';
import { useSync } from '@/state/sync';

export default function Settings() {
  const theme = useTheme();
  const router = useRouter();
  const pending = useSync((s) => s.pending);
  const failed = useSync((s) => s.failed);

  const Row = ({ label, hint, href }: { label: string; hint?: string; href: string }) => (
    <Box
      paddingVertical="cozy"
      borderBottomWidth={1}
      borderColor="borderSubtle"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
    >
      <Text variant="body" color="textPrimary" onPress={() => router.push(href as never)}>
        {label}
      </Text>
      {hint ? (
        <Text variant="bodySmall" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </Box>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}
      edges={['bottom']}
    >
      <Box padding="default" gap="tight">
        <Row label="Auth" href="/settings/auth" />
        <Row
          label="Sync details"
          hint={`${pending} pending · ${failed} failed`}
          href="/settings/sync-details"
        />
        <Row label="About" href="/settings/about" />
      </Box>
    </SafeAreaView>
  );
}
