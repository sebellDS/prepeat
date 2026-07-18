import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {visible && (
        <SheetContent
          editing={editing}
          initialText={initialText}
          positionCount={positionCount}
          initialPosition={initialPosition}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </Modal>
  );
}

function SheetContent({
  editing,
  initialText,
  positionCount,
  initialPosition,
  onClose,
  onSubmit,
}: {
  editing: boolean;
  initialText: string;
  positionCount: number;
  initialPosition: number;
  onClose: () => void;
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 justify-end"
    >
      <Pressable
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        className="bg-black/30"
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View
        style={{ maxHeight: "90%", marginBottom: -80, paddingBottom: 120 }}
        className="w-full gap-layout-small rounded-t-xlarge bg-surface-neutral-lightest p-layout-small"
      >
        <View className="w-full flex-row items-center">
          <Text className="flex-1 font-header text-display-5 font-emphasized text-text-default">
            {editing ? "Edit instruction" : "Add instruction"}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <SymbolView name="xmark" size={20} tintColor={ds.colors.icon.default} />
          </Pressable>
        </View>

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
      </View>
    </KeyboardAvoidingView>
  );
}
