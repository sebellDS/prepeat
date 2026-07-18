import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";

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
    <BottomSheet
      visible={visible}
      title={editing ? "Edit ingredient" : "Add ingredient"}
      onClose={onClose}
    >
      <SheetContent
        initialName={initialName}
        initialQuantity={initialQuantity}
        onSubmit={onSubmit}
      />
    </BottomSheet>
  );
}

function SheetContent({
  initialName,
  initialQuantity,
  onSubmit,
}: {
  initialName: string;
  initialQuantity: string;
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
    <>
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
    </>
  );
}
