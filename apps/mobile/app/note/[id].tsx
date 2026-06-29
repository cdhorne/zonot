// Read view (mobile-spec §7). Renders the note body as markdown and exposes the
// correction surface (edit / append / undo / delete — all ages, ADR-0026 r14)
// via a kebab. Undo/delete need no input and are wired here; edit/append reuse
// the capture editor and land as a follow-up. Reads come from the local mirror.

import { generateUlid, parseNoteFile } from '@zonot/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert } from 'react-native';
import Markdown from 'react-native-marked';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMirror } from '@/db/database';
import { Box, Text, useTheme } from '@/design/components';
import { haptics } from '@/lib/haptics';
import { enqueueOp } from '@/state/capture';
import { useSync } from '@/state/sync';
import { useWorkspace } from '@/state/workspace';

export default function NoteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workspace = useWorkspace((s) => s.workspace) ?? '';
  const flush = useSync((s) => s.flush);
  const refreshCounts = useSync((s) => s.refreshCounts);

  const note = useMemo(() => (id ? getMirror().getNote(id) : null), [id]);
  const parsed = useMemo(() => (note ? parseNoteFile(note.content, note.path) : null), [note]);

  function enqueue(op: 'undo' | 'delete') {
    if (!id) return;
    enqueueOp({ op, workspace, targetId: id, payload: {}, idempotencyKey: generateUlid() });
    if (op === 'delete') getMirror().remove(id); // optimistic
    haptics.warning();
    refreshCounts();
    void flush();
    router.back();
  }

  function openActions() {
    Alert.alert('Correct note', undefined, [
      { text: 'Undo last change', onPress: () => enqueue('undo') },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function confirmDelete() {
    Alert.alert('Delete this note?', 'This writes a delete commit; git history is preserved.', [
      { text: 'Delete', style: 'destructive', onPress: () => enqueue('delete') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (!note || !parsed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
        <Box flex={1} alignItems="center" justifyContent="center" padding="default">
          <Text variant="bodySmall" color="textSubtle">
            Note not in the local mirror.
          </Text>
        </Box>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="default"
        paddingVertical="cozy"
      >
        <Text variant="body" color="textLink" onPress={() => router.back()}>
          Back
        </Text>
        <Text variant="body" fontWeight="600" color="textPrimary" numberOfLines={1}>
          {parsed.frontmatter.title ?? ''}
        </Text>
        <Text variant="body" color="textLink" onPress={openActions}>
          ⋯
        </Text>
      </Box>

      <Markdown
        value={parsed.raw_body}
        flatListProps={{
          contentContainerStyle: {
            backgroundColor: theme.colors.surfaceCanvas,
            paddingHorizontal: theme.spacing.default,
            paddingBottom: theme.spacing.loose,
          },
        }}
      />

      {note.provisional ? (
        <Box paddingHorizontal="default" paddingBottom="cozy">
          <Text variant="monoSmall" color="textSubtle">
            syncing…
          </Text>
        </Box>
      ) : null}
    </SafeAreaView>
  );
}
