import { MaterialIcons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ds } from "@/constants/ds";

const ROW_HEIGHT = 52;

export interface ReorderItem {
  key: string;
  label: string;
}

/**
 * Generic drag-to-reorder sheet – the same interaction as the shopping
 * list's category reordering, reused for recipe ingredients and
 * instructions (Thomas, 2026-07-12).
 */
export function ReorderSheet({
  visible,
  title,
  hint,
  items,
  onClose,
  onChange,
}: {
  visible: boolean;
  title: string;
  hint: string;
  items: ReorderItem[];
  onClose: () => void;
  onChange: (orderedKeys: string[]) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView className="flex-1">
        <Pressable
          className="flex-1 bg-black/30"
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View className="w-full gap-layout-xsmall rounded-t-xlarge bg-surface-neutral-white p-layout-small pb-layout-large">
          <View className="w-full flex-row items-center">
            <Text className="flex-1 font-header text-display-5 font-emphasized text-text-default">
              {title}
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
          <Text className="font-paragraph text-small font-default text-text-subtle">
            {hint}
          </Text>
          <View
            style={{ height: items.length * ROW_HEIGHT }}
            className="w-full"
          >
            {items.map((item, index) => (
              <DraggableRow
                key={item.key}
                item={item}
                index={index}
                count={items.length}
                onMove={(from, to) => {
                  const next = [...items];
                  next.splice(to, 0, ...next.splice(from, 1));
                  onChange(next.map((entry) => entry.key));
                }}
              />
            ))}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function DraggableRow({
  item,
  index,
  count,
  onMove,
}: {
  item: ReorderItem;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}) {
  const translationY = useSharedValue(0);
  const [dragging, setDragging] = useState(false);

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
      translationY.value = withTiming(
        (to - index) * ROW_HEIGHT,
        { duration: 120 },
        () => {
          runOnJS(setDragging)(false);
          if (to !== index) {
            runOnJS(commitMove)(index, to);
          } else {
            translationY.value = 0;
          }
        },
      );
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translationY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: index * ROW_HEIGHT,
          height: ROW_HEIGHT,
          width: "100%",
        },
        dragging ? { zIndex: 10, elevation: 4 } : undefined,
        animatedStyle,
      ]}
      className={
        "flex-row items-center rounded-small px-comp-medium " +
        (dragging ? "bg-surface-neutral-lighter" : "bg-surface-neutral-white")
      }
    >
      <Text
        numberOfLines={1}
        className="flex-1 font-paragraph text-paragraph font-default text-text-default"
      >
        {item.label}
      </Text>
      <GestureDetector gesture={pan}>
        <View
          accessibilityLabel={`Reorder ${item.label}`}
          hitSlop={12}
          className="h-full items-center justify-center px-comp-small"
        >
          <MaterialIcons
            name="drag-handle"
            size={24}
            color={ds.colors.text.accent}
          />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}
