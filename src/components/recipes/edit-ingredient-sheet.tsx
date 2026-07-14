import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import { Input } from "@/components/ui/input";
import { ds } from "@/constants/ds";
import {
  addIngredient,
  updateIngredient,
  type RecipeIngredient,
} from "@/lib/recipes";

interface EditIngredientSheetProps {
  state: RecipeIngredient | "new" | null;
  recipeId: string;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Add/edit one ingredient (Figma "recipe – add ingredient"): name plus one
 * free-text quantity field, parsed into amount + unit at the database
 * boundary (recipes decision, 2026-07-12). The keyed inner component
 * re-initialises its fields per opened ingredient.
 */
export function EditIngredientSheet(props: EditIngredientSheetProps) {
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
  nextSortOrder,
  onClose,
  onSaved,
}: EditIngredientSheetProps) {
  const editing = state !== null && state !== "new" ? state : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [quantity, setQuantity] = useState(editing?.quantityText ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const trimmed = name.replace(/\s+/g, " ").trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      if (editing) {
        await updateIngredient(editing.id, trimmed, quantity.trim() || null);
      } else {
        await addIngredient(
          recipeId,
          trimmed,
          quantity.trim() || null,
          nextSortOrder,
        );
      }
      onSaved();
    } catch (error) {
      console.warn("[recipes] save ingredient failed", error);
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
      <View className="w-full gap-layout-small rounded-t-xlarge bg-surface-neutral-white p-layout-small pb-layout-large">
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
            <SymbolView
              name="xmark"
              size={20}
              tintColor={ds.colors.icon.default}
            />
          </Pressable>
        </View>
        <View className="w-full gap-comp-xsmall">
          <Text className="font-paragraph text-small font-default text-text-subtle">
            Name
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Cherry tomatoes"
            autoFocus
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
            onSubmitEditing={save}
            returnKeyType="done"
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
