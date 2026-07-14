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
import { addStep, updateStep, type RecipeStep } from "@/lib/recipes";

/**
 * Add/edit one instruction (Figma "recipe – add instruction"): a step
 * position picker (new steps land anywhere; following steps renumber) and
 * the instruction text.
 */
interface EditStepSheetProps {
  state: RecipeStep | "new" | null;
  recipeId: string;
  stepCount: number;
  onClose: () => void;
  onSaved: () => void;
}

export function EditStepSheet(props: EditStepSheetProps) {
  const { state, onClose } = props;
  return (
    <Modal
      visible={state != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {state != null && (
        <SheetContent key={state === "new" ? "new" : state.id} {...props} />
      )}
    </Modal>
  );
}

function SheetContent({
  state,
  recipeId,
  stepCount,
  onClose,
  onSaved,
}: EditStepSheetProps) {
  const editing = state !== null && state !== "new" ? state : null;
  const [text, setText] = useState(editing?.text ?? "");
  const [position, setPosition] = useState(
    editing?.stepNumber ?? stepCount + 1,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const textRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => textRef.current?.focus(), 450);
    return () => clearTimeout(timer);
  }, []);

  const positions = Array.from(
    { length: stepCount + (editing ? 0 : 1) },
    (_, i) => i + 1,
  );

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      if (editing) {
        await updateStep(editing.id, trimmed);
      } else {
        await addStep(recipeId, position, trimmed);
      }
      onSaved();
    } catch (error) {
      console.warn("[recipes] save step failed", error);
    } finally {
      setBusy(false);
    }
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
        style={{ maxHeight: "90%" }}
        className="w-full gap-layout-small rounded-t-xlarge bg-surface-neutral-white p-layout-small pb-layout-large"
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
            <SymbolView
              name="xmark"
              size={20}
              tintColor={ds.colors.icon.default}
            />
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
          onPress={save}
          disabled={busy}
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
