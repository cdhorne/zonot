// About (mobile-spec §8.1): version, license, schema version. Diagnostics export
// is a follow-up.
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box, Text, useTheme } from '@/design/components';

export default function About() {
  const theme = useTheme();
  const version = Constants.expoConfig?.version ?? '0.1.0';

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
      <Box padding="default" gap="cozy">
        <Text variant="heading2" color="textPrimary">
          Zonot
        </Text>
        <Text variant="bodySmall" color="textMuted">
          Calm on the surface, deep underneath. Your notes are plain Markdown in your own repo.
        </Text>
        <Box>
          <Field label="App version" value={version} />
          <Field label="Convention" value="v1" />
          <Field label="License" value="FSL-1.1-ALv2" />
        </Box>
      </Box>
    </SafeAreaView>
  );
}
