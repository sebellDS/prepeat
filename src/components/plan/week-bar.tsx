import { Pressable, Text, View } from "react-native";

import { DAY_LABELS, toDateKey, weekDates } from "@/lib/week";

/**
 * The connected day bar in the add-meal sheet (Figma weekBar 211:52272,
 * designed 2026-07-17): seven full-width segments, no gaps, hairlines
 * between. Selected segments use the active-chip pairing (decided with
 * Thomas: "build it as rendered" – the file's surface/primary/light
 * binding lags the DS and would be lime+white). All seven days always
 * show; past days keep their cell but get disabled text and no press
 * (decided 2026-07-17).
 */
export function WeekBar({
  weekStart,
  selectedDates,
  onToggle,
}: {
  weekStart: string;
  selectedDates: string[];
  onToggle: (date: string) => void;
}) {
  const todayKey = toDateKey(new Date());
  const dates = weekDates(weekStart);
  return (
    <View className="w-full flex-row overflow-hidden rounded-medium bg-surface-neutral-white">
      {dates.map((date, index) => {
        const selected = selectedDates.includes(date);
        const past = date < todayKey;
        return (
          <Pressable
            key={date}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: past }}
            accessibilityLabel={DAY_LABELS[index]}
            disabled={past}
            onPress={() => onToggle(date)}
            className={
              "flex-1 items-center justify-center py-layout-small " +
              (index < 6 ? "border-r border-surface-neutral-lightest " : "") +
              (selected ? "bg-chip-solid-fill-active" : "")
            }
          >
            <Text
              className={
                "font-paragraph text-small font-emphasized leading-xxsmall " +
                (selected
                  ? "text-chip-solid-label-active"
                  : past
                    ? "text-text-disabled"
                    : "text-text-default")
              }
            >
              {DAY_LABELS[index]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
