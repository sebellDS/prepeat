import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ServingsCounter } from "@/components/recipes/servings-counter";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { DAY_LABELS, DAY_NAMES, toDateKey, weekDates, weekStartOf } from "@/lib/week";

/**
 * "Add to weekly plan" from the recipe detail menu (wired 2026-07-16, the
 * revisit-recipes task): pick a day of the current week and a serving
 * count. No design for this sheet yet – it borrows the move-day rows and
 * the servings counter; restyle when Thomas draws it.
 */
export function AddToPlanSheet({
  visible,
  initialServings,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  initialServings: number;
  onClose: () => void;
  onSubmit: (date: string, servings: number) => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      title="Add to weekly plan"
      subtitle="Pick a day this week."
      onClose={onClose}
      scroll
    >
      {visible && (
        <SheetContent
          initialServings={initialServings}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </BottomSheet>
  );
}

function SheetContent({
  initialServings,
  onClose,
  onSubmit,
}: {
  initialServings: number;
  onClose: () => void;
  onSubmit: (date: string, servings: number) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [servings, setServings] = useState(initialServings);
  const today = toDateKey(new Date());
  const dates = weekDates(weekStartOf(new Date()));
  const canSubmit = selectedDate != null;

  return (
    <View className="w-full gap-layout-small">
      <View className="w-full gap-comp-small">
        {dates.map((date, index) => {
          const selected = date === selectedDate;
          // Planning never goes backward: past days keep their cell but are
          // disabled, same rule as the plan's WeekBar/DayRow (2026-07-17).
          const past = date < today;
          return (
            <Pressable
              key={date}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: past }}
              disabled={past}
              onPress={() => setSelectedDate(date)}
              className={
                "w-full flex-row items-center gap-comp-small overflow-hidden rounded-medium bg-surface-neutral-white " +
                (selected ? "border-2 border-surface-primary-main" : "")
              }
            >
              <View className="w-[64px] items-center justify-center bg-surface-neutral-lighter p-comp-large">
                <Text
                  className={
                    "font-paragraph text-small font-emphasized leading-xxsmall " +
                    (past ? "text-text-disabled" : "text-text-default")
                  }
                >
                  {DAY_LABELS[index]}
                </Text>
              </View>
              <Text
                className={
                  "flex-1 font-paragraph text-paragraph font-default leading-xsmall " +
                  (past ? "text-text-disabled" : "text-text-default")
                }
              >
                {DAY_NAMES[index]}
                {date === today ? " · today" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ServingsCounter value={servings} onChange={setServings} />
      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit}
        onPress={() => {
          if (selectedDate == null) return;
          onSubmit(selectedDate, servings);
          onClose();
        }}
        className={
          "w-full items-center rounded-medium py-comp-large " +
          (canSubmit
            ? "bg-button-solid-fill-enabled"
            : "bg-surface-neutral-light")
        }
      >
        <Text
          className={
            "font-paragraph text-components-button-label font-default " +
            (canSubmit
              ? "text-button-solid-label-enabled"
              : "text-text-disabled")
          }
        >
          Add to plan
        </Text>
      </Pressable>
    </View>
  );
}
