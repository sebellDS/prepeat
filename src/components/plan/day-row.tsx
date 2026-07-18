import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { MealRow } from "@/components/plan/meal-row";
import { ds } from "@/constants/ds";
import { type PlanEntry } from "@/lib/meal-plan";

/**
 * One day of the week view (Figma list rows 147:24391…): the day cell on
 * the left (today gets the secondary fill), the meals stacked beside it,
 * and "+ Add meal" at the bottom. Days hold a flat list of meals – no meal
 * types in v1 (decided 2026-07-16).
 */
export function DayRow({
  label,
  isToday,
  isPast,
  entries,
  onAddMeal,
  onPressMeal,
  onMove,
  onSwap,
  onServings,
  onRemove,
}: {
  label: string;
  isToday: boolean;
  /** Days gone by are read-only history (design 207:47746, 2026-07-17). */
  isPast: boolean;
  entries: PlanEntry[];
  onAddMeal: () => void;
  onPressMeal: (entry: PlanEntry) => void;
  onMove: (entry: PlanEntry) => void;
  onSwap: (entry: PlanEntry) => void;
  onServings: (entry: PlanEntry) => void;
  onRemove: (entry: PlanEntry) => void;
}) {
  return (
    <View className="w-full flex-row overflow-hidden rounded-medium">
      <View
        className={
          "w-[64px] items-center justify-center self-stretch p-layout-small " +
          (isToday ? "bg-surface-secondary-main" : "bg-surface-neutral-lighter")
        }
      >
        <Text
          className={
            "font-paragraph text-small font-emphasized leading-xxsmall " +
            (isToday
              ? "text-text-inverse"
              : isPast
                ? "text-text-disabled"
                : "text-text-default")
          }
        >
          {label}
        </Text>
      </View>
      <View className="min-w-0 flex-1 justify-center bg-surface-neutral-white">
        {entries.map((entry) => (
          <MealRow
            key={entry.id}
            entry={entry}
            onPress={() => onPressMeal(entry)}
            onMove={() => onMove(entry)}
            onSwap={() => onSwap(entry)}
            onServings={() => onServings(entry)}
            onRemove={() => onRemove(entry)}
          />
        ))}
        {isPast ? (
          // Empty past days state the fact quietly; days with meals just
          // show them (the design draws no add affordance for the past).
          entries.length === 0 && (
            <View className="w-full flex-row items-center gap-comp-small p-layout-small">
              <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-disabled">
                No meal added
              </Text>
            </View>
          )
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add meal`}
            onPress={onAddMeal}
            className="w-full flex-row items-center gap-comp-small p-layout-small"
          >
            <MaterialIcons
              name="add"
              size={24}
              color={ds.colors.surface.primary.main}
            />
            <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
              Add meal
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
