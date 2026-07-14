import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { ds } from '@/constants/ds';

/**
 * The servings counter from the Figma frames: − / value / + in one
 * input-shaped row. Used on the recipe detail (view scaling) and the
 * add/edit form (the recipe's base servings).
 */
export function ServingsCounter({
  value,
  onChange,
  min = 1,
  max = 99,
  formatLabel = (count: number) => `${count} people`,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  formatLabel?: (count: number) => string;
}) {
  return (
    <View className="w-full flex-row items-center overflow-hidden rounded-medium border border-forms-border-enabled bg-forms-background-default">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fewer servings"
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
        className="items-center justify-center px-comp-xlarge py-comp-large">
        <MaterialIcons
          name="remove"
          size={20}
          color={value <= min ? ds.colors.text.disabled : ds.colors.icon.default}
        />
      </Pressable>
      <Text className="flex-1 text-center font-paragraph text-paragraph font-default text-text-default">
        {formatLabel(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More servings"
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        className="items-center justify-center px-comp-xlarge py-comp-large">
        <MaterialIcons
          name="add"
          size={20}
          color={value >= max ? ds.colors.text.disabled : ds.colors.icon.default}
        />
      </Pressable>
    </View>
  );
}
