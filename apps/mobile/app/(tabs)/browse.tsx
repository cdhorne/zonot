// Browse / search (mobile-spec §6). One surface: a chronological feed grouped by
// day, with a search bar that flips to FTS results + snippets. Reads come from
// the local mirror (synchronous op-sqlite). Pull-to-refresh flushes the outbox.
// Facet chips + long-press quick-actions are follow-up polish.

import type { NoteSummary } from '@zonot/core/schema';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, SectionList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoteRow } from '@/components/NoteRow';
import { getMirror } from '@/db/database';
import { Box, Text, useTheme } from '@/design/components';
import { groupByDay } from '@/lib/datetime';
import { useSync } from '@/state/sync';
import { useWorkspace } from '@/state/workspace';

export default function Browse() {
  const theme = useTheme();
  const router = useRouter();
  const workspace = useWorkspace((s) => s.workspace) ?? '';
  const pending = useSync((s) => s.pending);
  const flush = useSync((s) => s.flush);
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0); // bump to re-read the mirror
  const [refreshing, setRefreshing] = useState(false);

  // Re-read whenever the screen regains focus (e.g. after a capture).
  useFocusEffect(useCallback(() => setTick((n) => n + 1), []));

  const searching = query.trim() !== '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` forces a reload
  const results = useMemo<NoteSummary[]>(() => {
    const mirror = getMirror();
    return searching
      ? mirror.search({ workspace, q: query }).results
      : mirror.listRecent({ workspace, limit: 200 });
  }, [workspace, query, searching, tick]);

  const sections = useMemo(
    () => groupByDay(results, Date.now()).map((g) => ({ title: g.bucket.label, data: g.rows })),
    [results],
  );

  async function onRefresh() {
    setRefreshing(true);
    await flush();
    setTick((n) => n + 1);
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }} edges={['top']}>
      <Box paddingHorizontal="default" paddingTop="cozy" gap="cozy">
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text variant="heading1" color="textPrimary">
            Browse
          </Text>
          <Box flexDirection="row" alignItems="center" gap="cozy">
            {pending >= 3 ? (
              <Box width={8} height={8} borderRadius="full" backgroundColor="statusWarning" />
            ) : null}
            <Text variant="body" color="textLink" onPress={() => router.push('/settings')}>
              Settings
            </Text>
          </Box>
        </Box>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes"
          placeholderTextColor={theme.colors.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            borderWidth: 1,
            borderColor: theme.colors.borderSubtle,
            borderRadius: theme.borderRadii.md,
            paddingHorizontal: theme.spacing.cozy,
            paddingVertical: theme.spacing.tight,
            color: theme.colors.textPrimary,
            fontSize: 16,
          }}
        />
      </Box>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NoteRow note={item} onPress={() => router.push(`/note/${item.id}`)} />
        )}
        renderSectionHeader={({ section }) => (
          <Box
            backgroundColor="surfaceCanvas"
            paddingHorizontal="default"
            paddingTop="cozy"
            paddingBottom="tight"
          >
            <Text variant="bodySmall" fontWeight="600" color="textMuted">
              {section.title}
            </Text>
          </Box>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Box padding="comfy" alignItems="center">
            <Text variant="bodySmall" color="textSubtle">
              {searching ? 'No matches.' : 'No notes yet — capture your first.'}
            </Text>
          </Box>
        }
      />
    </SafeAreaView>
  );
}
