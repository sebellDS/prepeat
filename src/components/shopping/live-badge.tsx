import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { ds } from '@/constants/ds';
import { useShoppingList } from '@/lib/shopping-list';

// Realtime connection indicator: green while the Supabase channel is
// subscribed (changes from other phones arrive instantly), grey while
// connecting or offline. Edits made while grey still save – they sync when
// the connection returns.
export function LiveBadge() {
  const { live } = useShoppingList();

  if (live === 'live') {
    return (
      <View className="size-[48px] items-center justify-center rounded-xlarge border border-success-dark bg-success-lighter">
        <SymbolView name="wifi" size={16} tintColor={ds.colors.success.darker} />
        <Text className="font-paragraph text-small font-emphasized text-success-darker">Live</Text>
      </View>
    );
  }

  return (
    <View className="size-[48px] items-center justify-center rounded-xlarge border border-border bg-surface-neutral-lighter">
      <SymbolView
        name={live === 'connecting' ? 'wifi' : 'wifi.slash'}
        size={16}
        tintColor={ds.colors.icon.default}
      />
      <Text className="font-paragraph text-small font-emphasized text-text-subtle">
        {live === 'connecting' ? '···' : 'Off'}
      </Text>
    </View>
  );
}
