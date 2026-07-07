import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { ds } from '@/constants/ds';
import { useShoppingList, type LiveStatus } from '@/lib/shopping-list';

// Realtime connection indicator, from the Figma statusBatch component set
// (node 27:347): one pill, three variants – Live (success), Connecting
// (info), Offline (error), each with its own Material icon. Edits made
// while not live still save – they sync when the connection returns.
const VARIANTS: Record<
  LiveStatus,
  { icon: keyof typeof MaterialIcons.glyphMap; label: string; box: string; text: string; tint: string }
> = {
  live: {
    icon: 'wifi',
    label: 'Live',
    box: 'border-success-dark bg-success-lighter',
    text: 'text-success-dark',
    tint: ds.colors.success.dark,
  },
  connecting: {
    icon: 'perm-scan-wifi',
    label: 'Connecting',
    box: 'border-info-dark bg-info-lighter',
    text: 'text-info-dark',
    tint: ds.colors.info.dark,
  },
  offline: {
    icon: 'wifi-off',
    label: 'Offline',
    box: 'border-error-dark bg-error-lighter',
    text: 'text-error-dark',
    tint: ds.colors.error.dark,
  },
};

export function LiveBadge() {
  const { live } = useShoppingList();
  const variant = VARIANTS[live];

  return (
    <View
      className={`flex-row items-center justify-center gap-layout-xxsmall rounded-xlarge border px-layout-xsmall py-layout-xxsmall ${variant.box}`}>
      <MaterialIcons name={variant.icon} size={16} color={variant.tint} />
      <Text
        className={`font-paragraph text-small font-emphasized leading-xxsmall ${variant.text}`}>
        {variant.label}
      </Text>
    </View>
  );
}
