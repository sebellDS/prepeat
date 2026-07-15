import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { Input } from "@/components/ui/input";
import { ds } from "@/constants/ds";

/**
 * Focused add/edit of one ingredient (Figma "recipe – add ingredient"):
 * name + one free-text quantity field. Presentational – it emits the edited
 * values via onSubmit; the caller persists them (to the database on the
 * recipe detail, or to the draft in the add/edit form). This keeps a single
 * focused editing experience everywhere (Pia's feedback, 2026-07-15).
 */
export function IngredientSheet({
  visible,
  editing,
  initialName,
  initialQuantity,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  editing: boolean;
  initialName: string;
  initialQuantity: string;
  onClose: () => void;
  onSubmit: (name: string, quantityText: string | null) => void;
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
          initialName={initialName}
          initialQuantity={initialQuantity}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </Modal>
  );
}

function SheetContent({
  editing,
  initialName,
  initialQuantity,
  onClose,
  onSubmit,
}: {
  editing: boolean;
  initialName: string;
  initialQuantity: string;
  onClose: () => void;
  onSubmit: (name: string, quantityText: string | null) => void;
}) {
  const [name, setName] = useState(initialName);
  const [quantity, setQuantity] = useState(initialQuantity);
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => nameRef.current?.focus(), 450);
    return () => clearTimeout(timer);
  }, []);

  const submit = () => {
    const trimmed = name.replace(/\s+/g, " ").trim();
    if (!trimmed) return;
    onSubmit(trimmed, quantity.trim() || null);
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
        style={{ marginBottom: -80, paddingBottom: 120 }}
        className="w-full gap-layout-small rounded-t-xlarge bg-surface-neutral-white p-layout-small"
      >
        <View className="w-full flex-row items-center">
          <Text className="flex-1 font-header text-display-5 font-emphasized text-text-default">
            {editing ? "Edit ingredient" : "Add ingredient"}
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
        <View className="w-full gap-comp-xsmall">
          <Text className="font-paragraph text-small font-default text-text-subtle">
            Name
          </Text>
          <Input
            ref={nameRef}
            value={name}
            onChangeText={setName}
            placeholder="Cherry tomatoes"
            accessibilityLabel="Name"
          />
        </View>
        <View className="w-full gap-comp-xsmall">
          <Text className="font-paragraph text-small font-default text-text-subtle">
            Quantity
          </Text>
          <Input
            value={quantity}
            onChangeText={setQuantity}
            placeholder="e.g. 250 g"
            accessibilityLabel="Quantity"
            onSubmitEditing={submit}
            returnKeyType="done"
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
