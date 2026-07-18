import { MaterialIcons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ds } from '@/constants/ds';
import type { Category } from '@/lib/shopping-list';

const ROW_HEIGHT = 52;

interface ReorderCategoriesSheetProps {
  visible: boolean;
  order: Category[];
  onClose: () => void;
  onChange: (order: Category[]) => void;
}

export function ReorderCategoriesSheet({
  visible,
  order,
  onClose,
  onChange,
}: ReorderCategoriesSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView className="flex-1">
        <Pressable className="flex-1 bg-black/30" onPress={onClose} accessibilityLabel="Close" />
        <View className="w-full gap-layout-xsmall rounded-t-xlarge bg-surface-neutral-lightest p-layout-small pb-layout-large">
          <View className="w-full flex-row items-center">
            <Text className="flex-1 font-header text-display-5 font-emphasized text-text-default">
              Reorder categories
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <SymbolView name="xmark" size={20} tintColor={ds.colors.icon.default} />
            </Pressable>
          </View>
          <Text className="font-paragraph text-small font-default text-text-subtle">
            Drag to match your walk through the store.
          </Text>
          <View style={{ height: order.length * ROW_HEIGHT }} className="w-full">
            {order.map((category, index) => (
              <DraggableRow
                key={category}
                category={category}
                index={index}
                count={order.length}
                onMove={(from, to) => {
                  const next = [...order];
                  next.splice(to, 0, ...next.splice(from, 1));
                  onChange(next);
                }}
              />
            ))}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

interface DraggableRowProps {
  category: Category;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}

function DraggableRow({ category, index, count, onMove }: DraggableRowProps) {
  const translationY = useSharedValue(0);
  const [dragging, setDragging] = useState(false);

  // Reset the drag offset in the same JS task that commits the new order, so
  // the row's new slot position and the zeroed translation paint together.
  const commitMove = (from: number, to: number) => {
    translationY.value = 0;
    onMove(from, to);
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      runOnJS(setDragging)(true);
    })
    .onUpdate((event) => {
      const min = -index * ROW_HEIGHT;
      const max = (count - 1 - index) * ROW_HEIGHT;
      translationY.value = Math.max(min, Math.min(max, event.translationY));
    })
    .onEnd(() => {
      const target = index + Math.round(translationY.value / ROW_HEIGHT);
      const to = Math.max(0, Math.min(count - 1, target));
      translationY.value = withTiming((to - index) * ROW_HEIGHT, { duration: 120 }, () => {
        runOnJS(setDragging)(false);
        if (to !== index) {
          runOnJS(commitMove)(index, to);
        } else {
          translationY.value = 0;
        }
      });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translationY.value }],
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', top: index * ROW_HEIGHT, height: ROW_HEIGHT, width: '100%' },
        dragging ? { zIndex: 10, elevation: 4 } : undefined,
        animatedStyle,
      ]}
      className={
        'flex-row items-center rounded-small px-comp-medium ' +
        (dragging ? 'bg-surface-neutral-lighter' : 'bg-surface-neutral-white')
      }>
      <Text className="flex-1 font-paragraph text-paragraph font-default text-text-default">
        {category}
      </Text>
      <GestureDetector gesture={pan}>
        <View
          accessibilityLabel={`Reorder ${category}`}
          hitSlop={12}
          className="h-full items-center justify-center px-comp-small">
          <MaterialIcons name="drag-handle" size={24} color={ds.colors.text.accent} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}
