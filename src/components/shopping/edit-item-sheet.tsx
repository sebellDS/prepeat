import { SymbolView } from "expo-symbols";
import {
  type MutableRefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { Keyboard, Pressable, Text, View } from "react-native";

import { BottomSheet, useBottomSheetScroll } from "@/components/ui/bottom-sheet";
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
  // Save lives in a ref so the pinned footer button can fire the form's own
  // save without lifting all the field state out of SheetContent.
  const saveRef = useRef<(() => void) | null>(null);
  return (
    <BottomSheet
      visible={item != null}
      title="Edit item"
      onClose={onClose}
      scroll
      // Hug the content (0 = no forced minimum): short when the category
      // picker is closed – no dead space above the Done button – and growing
      // to near full-height as the list opens (Thomas, 2026-07-30).
      minHeightPercent={0}
      maxHeightPercent={96}
      footer={
        <Pressable
          onPress={() => saveRef.current?.()}
          accessibilityRole="button"
          className="w-full items-center rounded-medium bg-button-solid-fill-enabled py-comp-large"
        >
          <Text className="font-paragraph text-components-button-label font-default text-button-solid-label-enabled">
            Done
          </Text>
        </Pressable>
      }
    >
      {item != null && (
        <SheetContent
          key={item.id}
          item={item}
          onClose={onClose}
          onSave={onSave}
          saveRef={saveRef}
        />
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
  saveRef: MutableRefObject<(() => void) | null>;
}

function SheetContent({ item, onClose, onSave, saveRef }: SheetContentProps) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? "");
  const [aisle, setAisle] = useState<Category | null>(item.aisle);
  const [pickerOpen, setPickerOpen] = useState(false);
  // The sheet's own ScrollView, plus where the Category block sits within it,
  // so opening the picker can scroll that block to the top (below).
  const sheetScroll = useBottomSheetScroll();
  const categoryY = useRef(0);

  const save = () => {
    onSave({ name, quantity: quantity.trim() || null, aisle });
    onClose();
  };
  // No dep array on purpose: re-point the ref after every render so the footer
  // button always fires the CURRENT field values, never a stale closure.
  useEffect(() => {
    saveRef.current = save;
    return () => {
      saveRef.current = null;
    };
  });

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

      <View
        className="w-full gap-comp-xsmall"
        onLayout={(event) => {
          categoryY.current = event.nativeEvent.layout.y;
        }}
      >
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
            setPickerOpen((value) => {
              const opening = !value;
              // On open, bring the whole Category block to the top of the
              // sheet so the options are visible without a manual scroll. The
              // delay lets the newly revealed list lay out first.
              if (opening) {
                setTimeout(
                  () =>
                    sheetScroll?.current?.scrollTo({
                      y: categoryY.current,
                      animated: true,
                    }),
                  120,
                );
              }
              return opening;
            });
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
          // The options flow inline so the sheet grows as the picker opens
          // (rather than a fixed capped box); the sheet's own scroll reaches
          // any that fall past 90% of the screen on a small phone.
          <View className="w-full overflow-hidden rounded-medium border border-border">
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
          </View>
        )}
      </View>
    </>
  );
}
