import { useEffect, useRef, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, TextInput, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Tabs, TabItem } from "@/components/ui/tabs";
import { ds } from "@/constants/ds";

/** Which kind of row the sheet is editing. */
export type IngredientKind = "ingredient" | "section";

/**
 * Focused add/edit of one ingredient OR one section heading (Figma
 * "recipe – add recipe" 495:5523 and 496:5761): a tab strip, a name field, and
 * a quantity field that belongs to ingredients only.
 *
 * Presentational – it emits the edited values via onSubmit; the caller
 * persists them (to the database on the recipe detail, or to the draft in the
 * add/edit form). One focused editing experience everywhere (Pia's feedback,
 * 2026-07-15).
 */
export function IngredientSheet({
  visible,
  editing,
  initialName,
  initialQuantity,
  initialKind = "ingredient",
  onDelete,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  editing: boolean;
  initialName: string;
  initialQuantity: string;
  /** Opening on an existing row starts on that row's tab. */
  initialKind?: IngredientKind;
  /**
   * Removes the row being edited. Only wired for SECTIONS: an ingredient is
   * deleted by swiping its row, but a heading sits outside the cards and has
   * no swipe, so without this it could not be deleted at all (Thomas,
   * 2026-08-06).
   */
  onDelete?: () => void;
  onClose: () => void;
  onSubmit: (
    name: string,
    quantityText: string | null,
    kind: IngredientKind,
  ) => void;
}) {
  // Lives here rather than in the body because the sheet TITLE follows the tab
  // ("Add ingredient" / "Add section", Thomas 2026-08-04).
  const [kind, setKind] = useState<IngredientKind>(initialKind);
  const noun = kind === "section" ? "section" : "ingredient";
  return (
    <BottomSheet
      visible={visible}
      title={`${editing ? "Edit" : "Add"} ${noun}`}
      onClose={onClose}
    >
      <Tabs>
        <TabItem
          label="Ingredient"
          active={kind === "ingredient"}
          divider
          onPress={() => setKind("ingredient")}
        />
        <TabItem
          label="Section"
          active={kind === "section"}
          onPress={() => setKind("section")}
        />
      </Tabs>
      <SheetContent
        kind={kind}
        initialName={initialName}
        initialQuantity={initialQuantity}
        onDelete={editing && kind === "section" ? onDelete : undefined}
        onSubmit={onSubmit}
      />
    </BottomSheet>
  );
}

function SheetContent({
  kind,
  initialName,
  initialQuantity,
  onDelete,
  onSubmit,
}: {
  kind: IngredientKind;
  initialName: string;
  initialQuantity: string;
  onDelete?: () => void;
  onSubmit: (
    name: string,
    quantityText: string | null,
    kind: IngredientKind,
  ) => void;
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
    // A heading never carries an amount, even if one was typed before the tab
    // was switched.
    onSubmit(
      trimmed,
      kind === "section" ? null : quantity.trim() || null,
      kind,
    );
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
          placeholder={
            kind === "section" ? "e.g. Sauce" : "e.g. Cherry tomatoes"
          }
          accessibilityLabel="Name"
          onSubmitEditing={kind === "section" ? submit : undefined}
          returnKeyType={kind === "section" ? "done" : undefined}
        />
      </View>
      {/* A section has a name and nothing else (Figma 496:5761). */}
      {kind === "ingredient" && (
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
      )}
      <Pressable
        onPress={submit}
        accessibilityRole="button"
        className="w-full items-center rounded-medium bg-button-solid-fill-enabled py-comp-large"
      >
        <Text className="font-paragraph text-components-button-label font-default text-button-solid-label-enabled">
          Done
        </Text>
      </Pressable>
      {/* IMPROVISED, and marked as such: Thomas asked for "red delete button
          with trash can icon, under the done button" (2026-08-06); no frame
          draws it. Shape follows the Done button above it; colours are the DS
          button/danger family, including the pressed state the DS defines. */}
      {onDelete != null && (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete section"
          className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium py-comp-large"
          style={({ pressed }) => ({
            backgroundColor: pressed
              ? ds.colors.button.danger.fill.pressed
              : ds.colors.button.danger.fill.enabled,
          })}
        >
          <MaterialIcons
            name="delete"
            size={24}
            color={ds.colors.button.danger.label.enabled}
          />
          <Text className="font-paragraph text-components-button-label font-default text-button-danger-label-enabled">
            Delete section
          </Text>
        </Pressable>
      )}
    </>
  );
}
