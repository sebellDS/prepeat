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
  /** Your own checks get the quiet outlined badge; others' are filled. */
  checkedByMe?: boolean;
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View
      className={
        checked
          ? 'size-[18px] items-center justify-center rounded-xsmall bg-surface-primary-main'
          : 'size-[18px] rounded-xsmall border border-border bg-surface-neutral-lightest'
      }>
      {checked && (
        <SymbolView name="checkmark" size={12} tintColor="#FFFFFF" weight="bold" />
      )}
    </View>
  );
}

export function ItemRow({
  item,
  onToggle,
  onEdit,
  onDelete,
  showInitial,
  checkedByMe,
}: ItemRowProps) {
  const swipeable = useRef<SwipeableMethods>(null);
  // A far swipe used to fire the row press on release and check the item
  // off (found on-device 2026-07-16). While the swipe is engaged, a row tap
  // only closes the actions again.
  const swipeEngaged = useRef(false);

  const handlePress = () => {
    if (swipeEngaged.current) {
      swipeable.current?.close();
      return;
    }
    onToggle();
  };

  // The whole row toggles (a checkbox alone is a small target in a store
  // aisle, Thomas 2026-07-08); edit and delete live behind the swipe.
  const row = (
    <Pressable
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.isChecked }}
      accessibilityLabel={item.name}
      className="w-full flex-row items-center gap-comp-small bg-surface-neutral-white p-layout-small">
      <View className="h-[24px] justify-center">
        <Checkbox checked={item.isChecked} />
      </View>
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
        // Figma initicial component (35:8260): outlined for your own
        // checks, filled secondary for the rest of the household.
        <View
          className={
            'size-[24px] items-center justify-center rounded-xlarge ' +
            (checkedByMe
              ? 'border border-surface-secondary-main bg-surface-neutral-lighter'
              : 'bg-surface-secondary-main')
          }>
          <Text
            className={
              'font-header text-display-6 font-emphasized leading-xsmall ' +
              (checkedByMe ? 'text-icon-accent' : 'text-text-inverse')
            }>
            {item.checkedByInitial}
          </Text>
        </View>
      )}
    </Pressable>
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
      onSwipeableOpenStartDrag={() => {
        swipeEngaged.current = true;
      }}
      onSwipeableWillOpen={() => {
        swipeEngaged.current = true;
      }}
      onSwipeableClose={() => {
        swipeEngaged.current = false;
      }}
      renderRightActions={() => (
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            onPress={() => {
              swipeable.current?.close();
              onEdit();
            }}
            className="w-[56px] items-center justify-center bg-surface-neutral-lighter">
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
