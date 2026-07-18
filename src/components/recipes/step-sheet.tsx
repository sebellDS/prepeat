import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { ds } from "@/constants/ds";

/**
 * Focused add/edit of one instruction. Presentational – emits the text (and,
 * when adding, the chosen position) via onSubmit; the caller persists. The
 * position picker only shows when adding, since editing keeps the step where
 * it is (reordering is a separate gesture).
 */
export function StepSheet({
  visible,
  editing,
  initialText,
  positionCount,
  initialPosition,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  editing: boolean;
  initialText: string;
  /** Number of positions offered when adding (existing steps + 1). */
  positionCount: number;
  initialPosition: number;
  onClose: () => void;
  onSubmit: (text: string, position: number) => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      title={editing ? "Edit instruction" : "Add instruction"}
      onClose={onClose}
      scroll
    >
      <SheetContent
        editing={editing}
        initialText={initialText}
        positionCount={positionCount}
        initialPosition={initialPosition}
        onSubmit={onSubmit}
      />
    </BottomSheet>
  );
}

function SheetContent({
  editing,
  initialText,
  positionCount,
  initialPosition,
  onSubmit,
}: {
  editing: boolean;
  initialText: string;
  positionCount: number;
  initialPosition: number;
  onSubmit: (text: string, position: number) => void;
}) {
  const [text, setText] = useState(initialText);
  const [position, setPosition] = useState(initialPosition);
  const [pickerOpen, setPickerOpen] = useState(false);
  const textRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => textRef.current?.focus(), 450);
    return () => clearTimeout(timer);
  }, []);

  const positions = Array.from({ length: positionCount }, (_, i) => i + 1);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed, position);
  };

  return (
    <>
      {!editing && (
        <View className="w-full gap-comp-xsmall">
          <Text className="font-paragraph text-small font-default text-text-subtle">
            Step
          </Text>
          <Pressable
            onPress={() => setPickerOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={`Step ${position}`}
            className="w-full flex-row items-center rounded-medium border border-forms-border-enabled bg-forms-background-default p-comp-large"
          >
            <Text className="flex-1 font-paragraph text-paragraph text-text-default">
              {position}
            </Text>
            <SymbolView
              name={pickerOpen ? "chevron.up" : "chevron.down"}
              size={14}
              tintColor={ds.colors.icon.default}
            />
          </Pressable>
          {pickerOpen && (
            <ScrollView
              className="w-full overflow-hidden rounded-medium border border-forms-border-enabled"
              style={{ maxHeight: 200 }}
              nestedScrollEnabled
            >
              {positions.map((option, index) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Step ${option}`}
                  onPress={() => {
                    setPosition(option);
                    setPickerOpen(false);
                  }}
                  className={
                    (option === position
                      ? "bg-success-lightest"
                      : "bg-surface-neutral-white") +
                    (index > 0
                      ? " border-t border-surface-neutral-lighter"
                      : "")
                  }
                >
                  <Text className="p-comp-medium font-paragraph text-paragraph text-text-default">
                    {option}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <View className="w-full gap-comp-xsmall">
        <Text className="font-paragraph text-small font-default text-text-subtle">
          Instruction
        </Text>
        <Input
          ref={textRef}
          value={text}
          onChangeText={setText}
          placeholder="Add your instruction here"
          accessibilityLabel="Instruction"
          multiline
          numberOfLines={4}
          style={{ minHeight: 96, textAlignVertical: "top" }}
        />
      </View>

      <Pressable
        onPress={submit}
        accessibilityRole="button"
        className="w-full items-center rounded-medium bg-button-solid-fill-enabled py-comp-large"
      >
        <Text className="font-paragraph text-components-button-label font-default text-button-solid-label-enabled">
          Done
        </Text>
      </Pressable>
    </>
  );
}
