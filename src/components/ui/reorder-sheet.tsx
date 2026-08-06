import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ds } from "@/constants/ds";

const ROW_HEIGHT = 56;

export interface ReorderItem {
  key: string;
  label: string;
  /**
   * A section heading rather than a row. Draws as a heading on the sheet's own
   * background, with its own handle, per Figma 508:13822. Lists without
   * sections (instructions, shopping categories) simply never set it.
   */
  isSection?: boolean;
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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // While a row is being dragged, freeze the scroll so the two vertical
  // gestures don't fight for the touch.
  const [dragging, setDragging] = useState(false);
  // Shared drag state so the OTHER rows can slide aside and open a gap where
  // the dragged row will land (Thomas, 2026-07-25). -1 = nothing is dragging.
  // The rows only READ these; writes go through setDrag, because the React
  // Compiler forbids a child mutating a shared value it received as a prop.
  const activeIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const setDrag = (active: number, hover: number) => {
    "worklet";
    activeIndex.value = active;
    hoverIndex.value = hover;
  };
  // Cap the sheet below the status bar / notch so a long ingredient list can't
  // push the title and close button off the top of the screen; the rows scroll
  // inside instead (Thomas, 2026-07-25: close was unreachable on a long list).
  // The list is capped rather than the sheet, so a long recipe scrolls its rows
  // while the title and close stay put (Thomas, 2026-07-25: close was
  // unreachable on a long list).
  const listMaxHeight = windowHeight - insets.top - 220;
  return (
    <BottomSheet
      visible={visible}
      title={title}
      subtitle={hint}
      onClose={onClose}
    >
      {/* Gestures inside a Modal need their own root on iOS. */}
      <GestureHandlerRootView style={{ flexShrink: 1 }}>
          <ScrollView
            scrollEnabled={!dragging}
            showsVerticalScrollIndicator={false}
            style={{ flexShrink: 1, maxHeight: listMaxHeight }}
            contentContainerStyle={{ height: items.length * ROW_HEIGHT }}
          >
            {items.map((item, index) => (
              <DraggableRow
                key={item.key}
                item={item}
                index={index}
                count={items.length}
                firstInCard={
                  !item.isSection &&
                  (index === 0 || items[index - 1].isSection === true)
                }
                lastInCard={
                  !item.isSection &&
                  (index === items.length - 1 ||
                    items[index + 1].isSection === true)
                }
                activeIndex={activeIndex}
                hoverIndex={hoverIndex}
                setDrag={setDrag}
                onDragChange={setDragging}
                onMove={(from, to) => {
                  const next = [...items];
                  next.splice(to, 0, ...next.splice(from, 1));
                  onChange(next.map((entry) => entry.key));
                }}
              />
            ))}
          </ScrollView>
      </GestureHandlerRootView>
    </BottomSheet>
  );
}

function DraggableRow({
  item,
  index,
  count,
  firstInCard,
  lastInCard,
  onMove,
  onDragChange,
  activeIndex,
  hoverIndex,
  setDrag,
}: {
  item: ReorderItem;
  index: number;
  count: number;
  firstInCard: boolean;
  lastInCard: boolean;
  onMove: (from: number, to: number) => void;
  onDragChange: (dragging: boolean) => void;
  activeIndex: SharedValue<number>;
  hoverIndex: SharedValue<number>;
  setDrag: (active: number, hover: number) => void;
}) {
  const translationY = useSharedValue(0);
  const [dragging, setDragging] = useState(false);

  // Keep the row's own lifted look and the sheet's scroll-freeze in step.
  const updateDragging = (value: boolean) => {
    setDragging(value);
    onDragChange(value);
  };

  const commitMove = (from: number, to: number) => {
    translationY.value = 0;
    onMove(from, to);
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      setDrag(index, index);
      runOnJS(updateDragging)(true);
    })
    .onUpdate((event) => {
      const min = -index * ROW_HEIGHT;
      const max = (count - 1 - index) * ROW_HEIGHT;
      translationY.value = Math.max(min, Math.min(max, event.translationY));
      // Which slot the row would drop into right now – the other rows watch
      // this to open the gap.
      const hover = Math.max(
        0,
        Math.min(count - 1, index + Math.round(translationY.value / ROW_HEIGHT)),
      );
      setDrag(index, hover);
    })
    .onEnd(() => {
      const to = hoverIndex.value;
      translationY.value = withTiming(
        (to - index) * ROW_HEIGHT,
        { duration: 120 },
        () => {
          setDrag(-1, -1);
          runOnJS(updateDragging)(false);
          if (to !== index) {
            runOnJS(commitMove)(index, to);
          } else {
            translationY.value = 0;
          }
        },
      );
    });

  const animatedStyle = useAnimatedStyle(() => {
    // The row under the finger follows it 1:1.
    if (activeIndex.value === index) {
      return { transform: [{ translateY: translationY.value }] };
    }
    // Everyone between the dragged row's origin and its hover slot steps one
    // place towards the origin, which opens the gap the row will drop into.
    let shift = 0;
    if (activeIndex.value !== -1) {
      const from = activeIndex.value;
      const to = hoverIndex.value;
      if (from < index && index <= to) shift = -ROW_HEIGHT;
      else if (to <= index && index < from) shift = ROW_HEIGHT;
    }
    return {
      transform: [{ translateY: withTiming(shift, { duration: 140 }) }],
    };
  });

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
        item.isSection
          ? // A heading has no card behind it; the right padding lines its
            // handle up with the row handles below (Figma 508:13966).
            "flex-row items-center pr-layout-small"
          : "flex-row items-center px-layout-small " +
            (dragging
              ? "bg-surface-neutral-lighter"
              : "bg-surface-neutral-white") +
            (firstInCard ? " rounded-t-large" : "") +
            (lastInCard ? " rounded-b-large" : "") +
            (lastInCard ? "" : " border-b border-border-subtle")
      }
    >
      <Text
        numberOfLines={1}
        className={
          item.isSection
            ? "flex-1 font-header text-display-6 font-emphasized text-text-default"
            : "flex-1 font-paragraph text-paragraph font-default text-text-default"
        }
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
