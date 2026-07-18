import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { ds } from "@/constants/ds";
import {
  CATEGORIES,
  type Category,
  type ShoppingItem,
} from "@/lib/shopping-list";

interface EditItemSheetProps {
  item: ShoppingItem | null;
  onClose: () => void;
  onSave: (fields: {
    name: string;
    quantity: string | null;
    aisle: Category | null;
  }) => void;
}

export function EditItemSheet({ item, onClose, onSave }: EditItemSheetProps) {
  return (
    <BottomSheet
      visible={item != null}
      title="Edit item"
      onClose={onClose}
      scroll
    >
      {item != null && (
        <SheetContent key={item.id} item={item} onClose={onClose} onSave={onSave} />
      )}
    </BottomSheet>
  );
}

interface SheetContentProps {
  item: ShoppingItem;
  onClose: () => void;
  onSave: (fields: {
    name: string;
    quantity: string | null;
    aisle: Category | null;
  }) => void;
}

function SheetContent({ item, onClose, onSave }: SheetContentProps) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? "");
  const [aisle, setAisle] = useState<Category | null>(item.aisle);
  const [pickerOpen, setPickerOpen] = useState(false);

  const save = () => {
    onSave({ name, quantity: quantity.trim() || null, aisle });
    onClose();
  };

  return (
    <>
      <View className="w-full gap-comp-xsmall">
        <Text className="font-paragraph text-small font-default text-text-subtle">
          Name
        </Text>
        <Input value={name} onChangeText={setName} accessibilityLabel="Name" />
      </View>

      <View className="w-full gap-comp-xsmall">
        <Text className="font-paragraph text-small font-default text-text-subtle">
          Quantity
        </Text>
        <Input
          value={quantity}
          onChangeText={setQuantity}
          placeholder="e.g. 250g"
          accessibilityLabel="Quantity"
        />
      </View>

      <View className="w-full gap-comp-xsmall">
        <Text className="font-paragraph text-small font-default text-text-subtle">
          Category
        </Text>
        <Text className="font-paragraph text-small font-default text-text-subtle">
          Your household will remember this.
        </Text>
        <Pressable
          onPress={() => {
            // The keyboard and the picker fight for the same space – hand it
            // over cleanly instead of flickering.
            Keyboard.dismiss();
            setPickerOpen((value) => !value);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Category: ${aisle ?? "none yet"}`}
          className="w-full flex-row items-center rounded-medium border border-forms-border-enabled bg-forms-background-default p-comp-large"
        >
          <Text
            className={
              "flex-1 font-paragraph text-paragraph " +
              (aisle == null ? "text-text-subtle" : "text-text-default")
            }
          >
            {aisle ?? "Choose a category"}
          </Text>
          <SymbolView
            name={pickerOpen ? "chevron.up" : "chevron.down"}
            size={14}
            tintColor={ds.colors.icon.default}
          />
        </Pressable>
        {pickerOpen && (
          // Capped and scrollable so all nine categories are reachable even on
          // small screens (bottom options were cut off before).
          <ScrollView
            className="w-full overflow-hidden rounded-medium border border-border"
            style={{ maxHeight: 264 }}
            nestedScrollEnabled
          >
            {CATEGORIES.map((category, index) => (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityLabel={category}
                onPress={() => {
                  setAisle(category);
                  setPickerOpen(false);
                }}
                className={
                  (category === aisle
                    ? "bg-success-lightest"
                    : "bg-surface-neutral-white") +
                  (index > 0
                    ? " border-t border-surface-neutral-lightest"
                    : "")
                }
              >
                <Text className="p-comp-medium font-paragraph text-paragraph text-text-default">
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <Pressable
        onPress={save}
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
