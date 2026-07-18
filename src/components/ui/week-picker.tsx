import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { ds } from "@/constants/ds";
import { isoWeekNumber, weekRangeLabel } from "@/lib/week";

/**
 * The week switcher, identical on the Plan and Shopping tabs (Figma
 * weekNav 163:38970; the quiet grey pill retired 2026-07-18): ‹ dates +
 * week number ›, 40px green chevrons that grey out when a direction is
 * closed. The Plan tab keeps "›" always enabled – past the last week it
 * creates the next one.
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
    <View className="w-full flex-row items-center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous week"
        disabled={!canGoBack}
        hitSlop={8}
        onPress={onBack}
      >
        <MaterialIcons
          name="chevron-left"
          size={40}
          color={
            canGoBack ? ds.colors.surface.primary.main : ds.colors.text.disabled
          }
        />
      </Pressable>
      <View className="min-w-0 flex-1 flex-row items-center justify-center gap-comp-xsmall">
        <Text
          numberOfLines={1}
          className="font-header text-display-6 font-emphasized leading-xsmall text-text-default"
        >
          {weekRangeLabel(weekStart)}
        </Text>
        <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
          Week {isoWeekNumber(weekStart)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next week"
        disabled={!canGoForward}
        hitSlop={8}
        onPress={onForward}
      >
        <MaterialIcons
          name="chevron-right"
          size={40}
          color={
            canGoForward
              ? ds.colors.surface.primary.main
              : ds.colors.text.disabled
          }
        />
      </Pressable>
    </View>
  );
}
