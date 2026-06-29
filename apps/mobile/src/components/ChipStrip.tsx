// The chip strip (mobile-spec §2.3). Renders parsed facet chips in body-position
// order; tap toggles a chip's enabled state (palette flips; body is untouched).
// Animations (slide-up/scale) are deferred polish — the strip is functional and
// reorders naturally as `chips` changes.

import type { ChipSpec } from '@zonot/core/schema';
import { Pressable } from 'react-native';
import { Box, Text } from '../design/components.tsx';

export function ChipStrip({
  chips,
  onToggle,
}: {
  chips: ChipSpec[];
  onToggle: (id: string) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <Box flexDirection="row" flexWrap="wrap" gap="tight" paddingVertical="tight">
      {chips.map((chip) => (
        <Chip key={chip.id} chip={chip} onPress={() => onToggle(chip.id)} />
      ))}
    </Box>
  );
}

function Chip({ chip, onPress }: { chip: ChipSpec; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Box
        flexDirection="row"
        alignItems="center"
        paddingVertical="tight"
        paddingHorizontal="cozy"
        borderRadius="full"
        backgroundColor={chip.enabled ? 'accentMuted' : 'surfaceCanvas'}
        borderWidth={chip.enabled ? 0 : 1}
        borderColor="borderSubtle"
      >
        <Text
          variant="bodySmall"
          color={chip.enabled ? 'textPrimary' : 'textMuted'}
          style={chip.enabled ? undefined : { textDecorationLine: 'line-through' }}
        >
          {chip.sigil}
          {chip.value}
        </Text>
      </Box>
    </Pressable>
  );
}
