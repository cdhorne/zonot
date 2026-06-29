// A browse-feed result row (mobile-spec §6.1): title + inline tag chips +
// timestamp, with an optional FTS snippet in search mode. Tap → read view.

import type { NoteSummary } from '@zonot/core/schema';
import { Pressable } from 'react-native';
import { Box, Text } from '../design/components.tsx';
import { clockTime } from '../lib/datetime.ts';

export function NoteRow({ note, onPress }: { note: NoteSummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Box paddingVertical="cozy" paddingHorizontal="default" gap="tight">
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap="cozy">
          <Box flex={1}>
            <Text variant="body" fontWeight="600" color="textPrimary" numberOfLines={1}>
              {note.title || '(untitled)'}
            </Text>
          </Box>
          <Text variant="monoSmall" color="textSubtle">
            {clockTime(note.created)}
          </Text>
        </Box>

        {note.snippet ? (
          <Text variant="bodySmall" color="textMuted" numberOfLines={2}>
            {stripMarks(note.snippet)}
          </Text>
        ) : null}

        {note.tags.length > 0 ? (
          <Box flexDirection="row" flexWrap="wrap" gap="tight">
            {note.tags.map((tag) => (
              <Text key={tag} variant="monoSmall" color="textLink">
                #{tag}
              </Text>
            ))}
          </Box>
        ) : null}
      </Box>
    </Pressable>
  );
}

// The FTS snippet wraps matches in <mark>…</mark>; strip the tags for plain
// rendering (highlight styling is deferred polish).
function stripMarks(snippet: string): string {
  return snippet.replace(/<\/?mark>/g, '');
}
