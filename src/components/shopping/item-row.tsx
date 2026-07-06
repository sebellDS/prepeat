import { MaterialIcons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ds } from '@/constants/ds';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { ShoppingItem } from '@/lib/shopping-list';

interface ItemRowProps {
  item: ShoppingItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Done-section rows show who checked the item and cannot be swiped. */
  showInitial?: boolean;
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View
      className={
        checked
          ? 'size-[18px] items-center justify-center rounded-xsmall bg-surface-primary-main'
          : 'size-[18px] rounded-xsmall border border-border bg-surface-neutral-lighter'
      }>
      {checked && (
        <SymbolView name="checkmark" size={12} tintColor="#FFFFFF" weight="bold" />
      )}
    </View>
  );
}

export function ItemRow({ item, onToggle, onEdit, onDelete, showInitial }: ItemRowProps) {
  const swipeable = useRef<SwipeableMethods>(null);

  const row = (
    <View className="w-full flex-row items-center gap-comp-small bg-surface-neutral-white p-layout-small">
      <Pressable
        onPress={onToggle}
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.isChecked }}
        accessibilityLabel={item.name}
        className="h-[24px] justify-center">
        <Checkbox checked={item.isChecked} />
      </Pressable>
      <View className="min-w-0 flex-1 justify-center">
        <Text className="font-paragraph text-paragraph font-default text-text-default">
          {item.name}
        </Text>
        {item.quantity != null && (
          <Text className="font-paragraph text-small font-default text-text-subtle">
            {item.quantity}
          </Text>
        )}
      </View>
      {showInitial && item.checkedByInitial != null && (
        <View className="size-[24px] items-center justify-center rounded-xlarge border border-text-accent">
          <Text className="font-paragraph text-small font-emphasized text-text-accent">
            {item.checkedByInitial}
          </Text>
        </View>
      )}
    </View>
  );

  if (showInitial) {
    return row;
  }

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            onPress={() => {
              swipeable.current?.close();
              onEdit();
            }}
            className="w-[56px] items-center justify-center bg-surface-neutral-light">
            <MaterialIcons name="edit-note" size={24} color={ds.colors.icon.default} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
            onPress={() => {
              swipeable.current?.close();
              onDelete();
            }}
            className="w-[56px] items-center justify-center bg-error">
            <SymbolView name="trash" size={20} tintColor="#FFFFFF" />
          </Pressable>
        </View>
      )}>
      {row}
    </ReanimatedSwipeable>
  );
}
