// Capture screen (mobile-spec §2) — the front door. Multiline body, live chip
// strip, save-to-DURABLE (mirror + outbox in one transaction) then a background
// sync flush. Save never blocks on sync state.

import type { CaptureInput } from '@zonot/core/schema';
import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChips } from '@/capture/useChips';
import { ChipStrip } from '@/components/ChipStrip';
import { Box, Text, useTheme } from '@/design/components';
import { haptics } from '@/lib/haptics';
import { saveCapture } from '@/state/capture';
import { useSync } from '@/state/sync';
import { useWorkspace } from '@/state/workspace';

export default function Capture() {
  const theme = useTheme();
  const workspace = useWorkspace((s) => s.workspace);
  const flush = useSync((s) => s.flush);
  const refreshCounts = useSync((s) => s.refreshCounts);
  const [body, setBody] = useState('');
  const [savedAt, setSavedAt] = useState(false);
  const chipState = useChips(body);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const canSave = body.trim() !== '' && workspace !== null;

  function onSave() {
    if (!canSave || !workspace) return;
    // Parse at save (not the debounced strip state) so fast saves keep facets.
    const facets = chipState.resolve(body);
    const input: CaptureInput = {
      workspace,
      output: {
        body,
        ...(facets.title !== undefined ? { title: facets.title } : {}),
        ...(facets.tags.length > 0 ? { tags: facets.tags } : {}),
        ...(facets.type !== undefined ? { type: facets.type } : {}),
      },
      ...(facets.thread !== undefined ? { thread: facets.thread } : {}),
    };
    saveCapture(input); // DURABLE
    haptics.light();
    setBody('');
    setSavedAt(true);
    refreshCounts();
    void flush(); // → SYNCED in the background
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSavedAt(false), 1200);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }} edges={['top']}>
      <Box flex={1} padding="default" gap="cozy">
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text variant="heading1" color="textPrimary">
            Capture
          </Text>
          <Text
            variant="body"
            fontWeight="600"
            color={canSave ? 'accentSolid' : 'textSubtle'}
            onPress={onSave}
          >
            Save
          </Text>
        </Box>

        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="What's on your mind?"
          placeholderTextColor={theme.colors.textSubtle}
          multiline
          autoFocus
          textAlignVertical="top"
          style={{
            flex: 1,
            color: theme.colors.textPrimary,
            fontSize: 17,
            lineHeight: 24,
          }}
        />

        <ChipStrip chips={chipState.chips} onToggle={chipState.toggle} />

        {chipState.chips.length === 0 ? (
          <Text variant="monoSmall" color="textSubtle">
            hint: #tag · @thread · !type
          </Text>
        ) : null}

        {savedAt ? (
          <Box position="absolute" top={0} left={0} right={0} alignItems="center" paddingTop="cozy">
            <Box
              backgroundColor="surfaceRaised"
              paddingVertical="tight"
              paddingHorizontal="default"
              borderRadius="full"
            >
              <Text variant="bodySmall" color="textPrimary">
                saved
              </Text>
            </Box>
          </Box>
        ) : null}
      </Box>
    </SafeAreaView>
  );
}
