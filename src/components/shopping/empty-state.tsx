import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { ds } from '@/constants/ds';

/**
 * Shown when this week's list has nothing on it – which now means the week has
 * no meals planned AND nothing added by hand. The old "Fill from weekly plan"
 * button retired with decision #8 (2026-07-25): a week's list follows its plan
 * on its own, so there is nothing to press. The copy says so instead.
 * IMPROVISED copy – no Figma frame for this state yet.
 */
export function EmptyState() {
  return (
    <View className="w-full px-layout-small">
      <View className="w-full items-start gap-layout-xsmall rounded-large bg-surface-neutral-white p-layout-small">
        <SymbolView name="cart" size={40} tintColor={ds.colors.surface.primary.main} />
        <Text className="font-header text-display-5 font-emphasized text-text-default">
          Time to prep
        </Text>
        <Text className="font-paragraph text-paragraph font-default text-text-default">
          Meals you plan for this week land here on their own. Add anything else
          you need above.
        </Text>
      </View>
    </View>
  );
}
