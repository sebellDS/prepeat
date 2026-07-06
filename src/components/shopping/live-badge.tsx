import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { ds } from '@/constants/ds';

// Realtime connection indicator. Static until the Supabase realtime channel
// is wired up; then it reflects the actual subscription state.
export function LiveBadge() {
  return (
    <View className="size-[48px] items-center justify-center rounded-xlarge border border-success-dark bg-success-lighter">
      <SymbolView name="wifi" size={16} tintColor={ds.colors.success.darker} />
      <Text className="font-paragraph text-small font-emphasized text-success-darker">Live</Text>
    </View>
  );
}
