import { Pressable, Text, View } from "react-native";

/**
 * The two-up tab strip used inside sheets (Figma 213:63962 – the add-meal
 * sheet's Recipes/Manual, and the ingredient sheet's Ingredient/Section).
 *
 * Extracted from add-meal-sheet.tsx on 2026-08-06 rather than copied into the
 * second caller. Today already produced two bugs from the same shape being
 * rebuilt by hand in several places, and a tab strip that drifts between
 * sheets is the visible version of that.
 */
export function Tabs({ children }: { children: React.ReactNode }) {
  return (
    <View className="w-full flex-row overflow-hidden rounded-small bg-surface-neutral-white">
      {children}
    </View>
  );
}

export function TabItem({
  label,
  active,
  divider = false,
  onPress,
}: {
  label: string;
  active: boolean;
  /** Hairline on the right, so the strip reads as segments rather than one bar. */
  divider?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={
        "flex-1 items-center justify-center px-layout-xsmall py-layout-small " +
        (active ? "bg-surface-secondary-main " : "") +
        (divider ? "border-r border-surface-neutral-lightest" : "")
      }
    >
      <Text
        className={
          "font-paragraph text-small font-emphasized leading-xxsmall " +
          (active ? "text-text-inverse" : "text-text-default")
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
