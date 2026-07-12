import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { ds } from '@/constants/ds';

// Interactive filter/selection chip from the Sebell DS (Chip component,
// chip/* appearance tokens). Resting states ride the neutral ramp, the
// selected ("active") states flip to the brand ramp. The DS defines six
// states; native has no hover, so the chip uses enabled/pressed/active/
// active-pressed. Disabled is the DS-universal 50% opacity rule. Icons
// render at 16px in the label colour, matching the DS icon rule.

export type ChipVariant = 'solid' | 'outline';

type ChipState = 'enabled' | 'pressed' | 'active' | 'active-pressed';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  /** Selected state of the toggle. */
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /** Icon rendered before the label. */
  startIcon?: keyof typeof MaterialIcons.glyphMap;
  /** Icon rendered after the label. */
  endIcon?: keyof typeof MaterialIcons.glyphMap;
}

// Full literal class strings so Tailwind's scanner picks them up.
const BOX: Record<ChipVariant, Record<ChipState, string>> = {
  solid: {
    enabled: 'bg-chip-solid-fill-enabled',
    pressed: 'bg-chip-solid-fill-pressed',
    active: 'bg-chip-solid-fill-active',
    'active-pressed': 'bg-chip-solid-fill-active-pressed',
  },
  outline: {
    enabled: 'border border-chip-outline-border-enabled bg-transparent',
    pressed: 'border border-chip-outline-border-pressed bg-chip-outline-fill-pressed',
    active: 'border border-chip-outline-border-active bg-chip-outline-fill-active',
    'active-pressed':
      'border border-chip-outline-border-active-pressed bg-chip-outline-fill-active-pressed',
  },
};

const LABEL: Record<ChipVariant, Record<ChipState, string>> = {
  solid: {
    enabled: 'text-chip-solid-label-enabled',
    pressed: 'text-chip-solid-label-pressed',
    active: 'text-chip-solid-label-active',
    'active-pressed': 'text-chip-solid-label-active-pressed',
  },
  outline: {
    enabled: 'text-chip-outline-label-enabled',
    pressed: 'text-chip-outline-label-pressed',
    active: 'text-chip-outline-label-active',
    'active-pressed': 'text-chip-outline-label-active-pressed',
  },
};

export function Chip({
  label,
  variant = 'solid',
  active = false,
  disabled = false,
  onPress,
  startIcon,
  endIcon,
}: ChipProps) {
  return (
    <Pressable
      className="self-start"
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}>
      {({ pressed }) => {
        const state: ChipState =
          active && pressed
            ? 'active-pressed'
            : active
              ? 'active'
              : pressed
                ? 'pressed'
                : 'enabled';
        const tint = ds.colors.chip[variant].label[state];
        return (
          <View
            className={`flex-row items-center justify-center gap-comp-xsmall rounded-xlarge px-comp-large py-comp-small ${BOX[variant][state]} ${disabled ? 'opacity-50' : ''}`}>
            {startIcon ? <MaterialIcons name={startIcon} size={16} color={tint} /> : null}
            <Text
              className={`font-paragraph text-components-label font-default leading-xxsmall ${LABEL[variant][state]}`}>
              {label}
            </Text>
            {endIcon ? <MaterialIcons name={endIcon} size={16} color={tint} /> : null}
          </View>
        );
      }}
    </Pressable>
  );
}
