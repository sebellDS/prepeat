import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Placeholder for tabs whose screens are not designed yet.
export function ComingSoon({ title }: { title: string }) {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-neutral-lightest">
      <View className="w-full px-layout-small pb-layout-small">
        <Text className="font-header text-display-4 font-emphasized leading-medium text-text-default">
          {title}
        </Text>
      </View>
      <View className="flex-1 items-center justify-center px-layout-large">
        <Text className="text-center font-paragraph text-paragraph font-default text-text-subtle">
          This part of Prep+Eat is still in the kitchen.
        </Text>
      </View>
    </SafeAreaView>
  );
}
