// Sync details (mobile-spec §4): the forensic queue/error screen. No PII or note
// bodies — only op type, timestamps, status, attempts, and RFC 9457 problems.

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { getOutbox } from '@/db/database';
import { Box, Text, useTheme } from '@/design/components';
import { clockTime } from '@/lib/datetime';
import { useSync } from '@/state/sync';
import type { OutboxRow } from '@/sync/outbox';

export default function SyncDetails() {
  const theme = useTheme();
  const pending = useSync((s) => s.pending);
  const failed = useSync((s) => s.failed);
  const flush = useSync((s) => s.flush);
  const [tick, setTick] = useState(0);

  useFocusEffect(useCallback(() => setTick((n) => n + 1), []));
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` forces a reload
  const rows = useMemo<OutboxRow[]>(() => getOutbox().recent(25), [tick]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}
      edges={['bottom']}
    >
      <Box padding="default" gap="default">
        <Text variant="body" color="textPrimary">
          {pending} pending · {failed} failed
        </Text>

        <Box>
          {rows.map((row) => (
            <Box
              key={row.id}
              flexDirection="row"
              justifyContent="space-between"
              paddingVertical="tight"
              borderBottomWidth={1}
              borderColor="borderSubtle"
            >
              <Text variant="monoSmall" color="textMuted">
                {clockTime(row.created_at)} {row.op}
              </Text>
              <Text variant="monoSmall" color={statusColor(row.status)}>
                {row.status} · {row.attempts}
              </Text>
            </Box>
          ))}
          {rows.length === 0 ? (
            <Text variant="bodySmall" color="textSubtle">
              Queue is empty.
            </Text>
          ) : null}
        </Box>

        <Button
          label="Retry queue now"
          variant="secondary"
          onPress={() => {
            void flush().then(() => setTick((n) => n + 1));
          }}
        />
      </Box>
    </SafeAreaView>
  );
}

function statusColor(status: OutboxRow['status']): 'textMuted' | 'statusDanger' | 'statusSuccess' {
  if (status === 'failed-permanent') return 'statusDanger';
  if (status === 'synced') return 'statusSuccess';
  return 'textMuted';
}
