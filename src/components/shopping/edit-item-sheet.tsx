import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ds } from '@/constants/ds';
import { CATEGORIES, type Category, type ShoppingItem } from '@/lib/shopping-list';

interface EditItemSheetProps {
  item: ShoppingItem | null;
  onClose: () => void;
  onSave: (fields: { name: string; quantity: string | null; aisle: Category | null }) => void;
}

export function EditItemSheet({ item, onClose, onSave }: EditItemSheetProps) {
  return (
    <Modal visible={item != null} transparent animationType="slide" onRequestClose={onClose}>
      {item != null && <SheetContent key={item.id} item={item} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

interface SheetContentProps {
  item: ShoppingItem;
  onClose: () => void;
  onSave: (fields: { name: string; quantity: string | null; aisle: Category | null }) => void;
}

function SheetContent({ item, onClose, onSave }: SheetContentProps) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? '');
  const [aisle, setAisle] = useState<Category | null>(item.aisle);
  const [pickerOpen, setPickerOpen] = useState(false);

  const save = () => {
    onSave({ name, quantity: quantity.trim() || null, aisle });
    onClose();
  };

  return (
    <>
      <Pressable className="flex-1 bg-black/30" onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="w-full gap-layout-small rounded-t-xlarge bg-surface-neutral-white p-layout-small pb-layout-large">
          <View className="w-full flex-row items-center">
            <Text className="flex-1 font-header text-display-5 font-emphasized text-text-default">
              Edit item
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <SymbolView name="xmark" size={20} tintColor={ds.colors.icon.default} />
            </Pressable>
          </View>

          <View className="w-full gap-comp-xsmall">
            <Text className="font-paragraph text-small font-default text-text-subtle">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              accessibilityLabel="Name"
              className="w-full rounded-small border border-border bg-surface-neutral-lighter p-comp-large font-paragraph text-paragraph text-text-default"
            />
          </View>

          <View className="w-full gap-comp-xsmall">
            <Text className="font-paragraph text-small font-default text-text-subtle">Quantity</Text>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              placeholder="e.g. 250g"
              placeholderTextColor={ds.colors.text.disabled}
              accessibilityLabel="Quantity"
              className="w-full rounded-small border border-border bg-surface-neutral-lighter p-comp-large font-paragraph text-paragraph text-text-default"
            />
          </View>

          <View className="w-full gap-comp-xsmall">
            <Text className="font-paragraph text-small font-default text-text-subtle">Category</Text>
            <Pressable
              onPress={() => {
                // The keyboard and the picker fight for the same space –
                // hand it over cleanly instead of flickering.
                Keyboard.dismiss();
                setPickerOpen((value) => !value);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${aisle ?? 'none yet'}`}
              className="w-full flex-row items-center rounded-small border border-border bg-surface-neutral-lighter p-comp-large">
              <Text
                className={
                  'flex-1 font-paragraph text-paragraph ' +
                  (aisle == null ? 'text-text-subtle' : 'text-text-default')
                }>
                {aisle ?? 'Choose a category'}
              </Text>
              <SymbolView
                name={pickerOpen ? 'chevron.up' : 'chevron.down'}
                size={14}
                tintColor={ds.colors.icon.default}
              />
            </Pressable>
            {pickerOpen && (
              // Capped and scrollable so all nine categories are reachable
              // even on small screens (bottom options were cut off before).
              <ScrollView
                className="w-full overflow-hidden rounded-small border border-border"
                style={{ maxHeight: 264 }}
                nestedScrollEnabled>
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
                        ? 'bg-success-lighter'
                        : 'bg-surface-neutral-white') +
                      (index > 0 ? ' border-t border-surface-neutral-lighter' : '')
                    }>
                    <Text className="p-comp-medium font-paragraph text-paragraph text-text-default">
                      {category}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Text className="font-paragraph text-small font-default text-text-subtle">
              Your household will remember this.
            </Text>
          </View>

          <View className="w-full flex-row items-center justify-between pt-comp-small">
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              className="rounded-small border border-surface-primary-main px-comp-xlarge py-comp-medium">
              <Text className="font-paragraph text-components-button-label font-default text-text-subtle">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={save}
              accessibilityRole="button"
              className="rounded-small bg-surface-primary-main px-comp-xlarge py-comp-medium">
              <Text className="font-paragraph text-components-button-label font-emphasized text-text-default">
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
