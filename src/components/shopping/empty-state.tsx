import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { ds } from '@/constants/ds';

interface EmptyStateProps {
  onFillFromPlan: () => void;
}

export function EmptyState({ onFillFromPlan }: EmptyStateProps) {
  return (
    <View className="w-full px-layout-small">
      <View className="w-full items-start gap-layout-xsmall rounded-large bg-surface-neutral-white p-layout-small">
        <SymbolView name="cart" size={40} tintColor={ds.colors.surface.primary.main} />
        <Text className="font-header text-display-5 font-emphasized text-text-default">
          Time to prep
        </Text>
        <Text className="font-paragraph text-paragraph font-default text-text-default">
          Add items above, or fill the list from your weekly plan
        </Text>
        <Pressable
          onPress={onFillFromPlan}
          accessibilityRole="button"
          className="mt-comp-small rounded-small border border-surface-primary-main px-comp-xlarge py-comp-medium">
          <Text className="font-paragraph text-components-button-label font-default text-text-subtle">
            Fill from weekly plan
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
