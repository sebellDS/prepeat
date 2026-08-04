import { type MutableRefObject, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ServingsCounter } from "@/components/recipes/servings-counter";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { WeekPicker } from "@/components/ui/week-picker";
import { useCurrentWeekStart, useTodayKey } from "@/lib/use-today";
import {
  addWeeksKey,
  DAY_LABELS,
  DAY_NAMES,
  weekDates,
} from "@/lib/week";

/**
 * "Add to weekly plan" from the recipe detail menu (wired 2026-07-16, the
 * revisit-recipes task): pick a day and a serving count. The week navigator
 * (added 2026-07-30) lets you plan a recipe into a future week too, not just
 * the current one; going back stops at the current week (no planning the
 * past). The "Add to plan" button is pinned as the sheet footer so it stays
 * fully on screen however tall the day list grows (Thomas, 2026-07-30 – it was
 * scrolling half off the bottom). No design for this sheet yet – it borrows the
 * move-day rows, the week nav and the servings counter; restyle when Thomas
 * draws it.
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
  // Save/submit lives in a ref so the pinned footer fires the form's own
  // submit with current field values (same pattern as the edit-item sheet);
  // canSubmit mirrors up so the footer can disable until a day is picked.
  const submitRef = useRef<(() => void) | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  return (
    <BottomSheet
      visible={visible}
      title="Add to weekly plan"
      subtitle="Pick a day."
      onClose={onClose}
      scroll
      // Grow to near full-height so the week nav, all seven days and the
      // servings counter show above the pinned button (Thomas, 2026-07-30).
      maxHeightPercent={96}
      footer={
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={() => submitRef.current?.()}
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
      }
    >
      {visible && (
        <SheetContent
          initialServings={initialServings}
          submitRef={submitRef}
          onCanSubmitChange={setCanSubmit}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </BottomSheet>
  );
}

function SheetContent({
  initialServings,
  submitRef,
  onCanSubmitChange,
  onClose,
  onSubmit,
}: {
  initialServings: number;
  submitRef: MutableRefObject<(() => void) | null>;
  onCanSubmitChange: (canSubmit: boolean) => void;
  onClose: () => void;
  onSubmit: (date: string, servings: number) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [servings, setServings] = useState(initialServings);
  // Both live, and both off the same tick – reading the clock in a render body
  // is cached forever by the React Compiler (see use-today.ts). The sheet can
  // sit open across midnight, and it decides which DAY a meal lands on.
  const today = useTodayKey();
  const currentWeekStart = useCurrentWeekStart();
  // The viewed week – starts on the current week; the nav walks forward to
  // plan a later week and stops at the current one going back.
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const dates = weekDates(weekStart);
  const canSubmit = selectedDate != null;

  const submit = () => {
    if (selectedDate == null) return;
    onSubmit(selectedDate, servings);
    onClose();
  };
  // No dep array: re-point the ref after every render so the footer button
  // always fires the CURRENT selection, never a stale closure.
  useEffect(() => {
    submitRef.current = submit;
    return () => {
      submitRef.current = null;
    };
  });
  useEffect(() => {
    onCanSubmitChange(canSubmit);
  }, [canSubmit, onCanSubmitChange]);

  return (
    <View className="w-full gap-layout-small">
      <WeekPicker
        weekStart={weekStart}
        canGoBack={weekStart > currentWeekStart}
        canGoForward
        onBack={() => setWeekStart((week) => addWeeksKey(week, -1))}
        onForward={() => setWeekStart((week) => addWeeksKey(week, 1))}
      />
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
    </View>
  );
}
