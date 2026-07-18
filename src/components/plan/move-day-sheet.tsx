import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ds } from "@/constants/ds";
import { DAY_LABELS, DAY_NAMES, weekDates } from "@/lib/week";

/**
 * Swipe action "move" (Figma "Add to new day" 147:28057, retitled per the
 * design review 2026-07-16): pick the day this meal moves to. The day it is
 * already on is disabled.
 */
export function MoveDaySheet({
  visible,
  weekStart,
  currentDate,
  onClose,
  onMove,
}: {
  visible: boolean;
  weekStart: string;
  /** The date the meal is on now ('YYYY-MM-DD'). */
  currentDate: string;
  onClose: () => void;
  onMove: (date: string) => void;
}) {
  const dates = weekDates(weekStart);
  return (
    <BottomSheet
      visible={visible}
      title="Move to another day"
      subtitle="Feel like having this meal on another day?"
      onClose={onClose}
    >
      <View className="w-full gap-comp-small">
        {dates.map((date, index) => {
          const disabled = date === currentDate;
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={`Move meal to ${DAY_NAMES[index]}`}
              disabled={disabled}
              onPress={() => {
                onMove(date);
                onClose();
              }}
              className={
                "w-full flex-row items-center gap-comp-small overflow-hidden rounded-medium bg-surface-neutral-white " +
                (disabled ? "opacity-40" : "")
              }
            >
              <View className="w-[64px] items-center justify-center bg-surface-neutral-lighter p-comp-large">
                <Text className="font-paragraph text-small font-emphasized leading-xxsmall text-text-default">
                  {DAY_LABELS[index]}
                </Text>
              </View>
              <MaterialIcons
                name="edit-calendar"
                size={20}
                color={ds.colors.icon.default}
              />
              {/* Day name only – "Move to Monday" doubled the chip
                  (feedback 2026-07-16). */}
              <Text className="flex-1 font-paragraph text-paragraph font-default leading-xsmall text-text-default">
                {disabled ? "Already on this day" : DAY_NAMES[index]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
