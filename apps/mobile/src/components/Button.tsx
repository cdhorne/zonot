// Themed button (mobile-spec §1.1). Primary = solid accent; secondary = hollow.
// Never a raw Pressable with inline colours — roles only.

import { createBox } from '@shopify/restyle';
import { Pressable, type PressableProps } from 'react-native';
import { Text } from '../design/components.tsx';
import type { Theme } from '../design/theme.ts';

const PressableBox = createBox<Theme, PressableProps>(Pressable);

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <PressableBox
      onPress={onPress}
      disabled={disabled}
      backgroundColor={primary ? 'accentSolid' : 'surfaceRaised'}
      borderWidth={primary ? 0 : 1}
      borderColor="borderDefault"
      paddingVertical="cozy"
      paddingHorizontal="default"
      borderRadius="md"
      alignItems="center"
      justifyContent="center"
      opacity={disabled ? 0.45 : 1}
    >
      <Text variant="body" fontWeight="600" color={primary ? 'accentText' : 'textPrimary'}>
        {label}
      </Text>
    </PressableBox>
  );
}
