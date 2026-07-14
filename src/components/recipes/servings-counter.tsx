import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { ds } from "@/constants/ds";

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
  // Design (counter 108:327): − | divider | value | divider | + in one
  // 56px input-shaped row.
  return (
    <View className="h-[56px] w-full flex-row items-center gap-comp-large overflow-hidden rounded-medium border border-forms-border-enabled bg-forms-background-default px-comp-large">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fewer servings"
        disabled={value <= min}
        hitSlop={12}
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <MaterialIcons
          name="remove"
          size={24}
          color={
            value <= min ? ds.colors.text.disabled : ds.colors.icon.default
          }
        />
      </Pressable>
      <View className="h-full w-px bg-forms-border-enabled" />
      <Text className="flex-1 text-center font-paragraph text-paragraph font-default leading-xsmall text-text-default">
        {formatLabel(value)}
      </Text>
      <View className="h-full w-px bg-forms-border-enabled" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More servings"
        disabled={value >= max}
        hitSlop={12}
        onPress={() => onChange(Math.min(max, value + 1))}
      >
        <MaterialIcons
          name="add"
          size={24}
          color={
            value >= max ? ds.colors.text.disabled : ds.colors.icon.default
          }
        />
      </Pressable>
    </View>
  );
}
