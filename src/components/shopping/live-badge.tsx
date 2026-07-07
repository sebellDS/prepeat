import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { ds } from '@/constants/ds';
import { useShoppingList } from '@/lib/shopping-list';

// Realtime connection indicator, from the Figma statusBatch component
// (node 29:1269): a compact pill with a wifi icon and label. Green while
// the Supabase channel is subscribed; the connecting/offline looks reuse
// the pill with neutral tokens until Thomas designs those states. Edits
// made while grey still save – they sync when the connection returns.
export function LiveBadge() {
  const { live } = useShoppingList();

  if (live === 'live') {
    return (
      <View className="flex-row items-center justify-center gap-layout-xxsmall rounded-xlarge border border-success-dark bg-success-lighter px-layout-xsmall py-layout-xxsmall">
        <SymbolView name="wifi" size={16} tintColor={ds.colors.success.dark} />
        <Text className="font-paragraph text-small font-emphasized leading-xxsmall text-success-dark">
          Live
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-center gap-layout-xxsmall rounded-xlarge border border-border bg-surface-neutral-lighter px-layout-xsmall py-layout-xxsmall">
      <SymbolView
        name={live === 'connecting' ? 'wifi' : 'wifi.slash'}
        size={16}
        tintColor={ds.colors.icon.default}
      />
      <Text className="font-paragraph text-small font-emphasized leading-xxsmall text-text-subtle">
        {live === 'connecting' ? 'Connecting' : 'Offline'}
      </Text>
    </View>
  );
}
