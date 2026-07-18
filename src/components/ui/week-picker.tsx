import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { ds } from "@/constants/ds";
import { weekPickerLabel } from "@/lib/week";

/**
 * The week switcher: ‹ July 13-19 · Week 29 ›. One unified style on both
 * tabs since 2026-07-16 (Figma weekPicker component 164:2508): quiet grey
 * fill, no border. Chevrons disable at the edges – it only moves between
 * weeks that exist.
 */
export function WeekPicker({
  weekStart,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  weekStart: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) {
  return (
    <View className="w-full flex-row items-center gap-comp-large overflow-hidden rounded-medium bg-surface-neutral-lighter p-layout-small">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous week"
        disabled={!canGoBack}
        hitSlop={12}
        onPress={onBack}
      >
        <MaterialIcons
          name="chevron-left"
          size={24}
          color={canGoBack ? ds.colors.icon.default : ds.colors.text.disabled}
        />
      </Pressable>
      <Text
        numberOfLines={1}
        className="flex-1 text-center font-paragraph text-paragraph font-default leading-xsmall text-text-default"
      >
        {weekPickerLabel(weekStart)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next week"
        disabled={!canGoForward}
        hitSlop={12}
        onPress={onForward}
      >
        <MaterialIcons
          name="chevron-right"
          size={24}
          color={
            canGoForward ? ds.colors.icon.default : ds.colors.text.disabled
          }
        />
      </Pressable>
    </View>
  );
}
