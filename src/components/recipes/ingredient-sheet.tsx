import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Tabs, TabItem } from "@/components/ui/tabs";

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
  onClose,
  onSubmit,
}: {
  visible: boolean;
  editing: boolean;
  initialName: string;
  initialQuantity: string;
  /** Opening on an existing row starts on that row's tab. */
  initialKind?: IngredientKind;
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
        onSubmit={onSubmit}
      />
    </BottomSheet>
  );
}

function SheetContent({
  kind,
  initialName,
  initialQuantity,
  onSubmit,
}: {
  kind: IngredientKind;
  initialName: string;
  initialQuantity: string;
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
    </>
  );
}
