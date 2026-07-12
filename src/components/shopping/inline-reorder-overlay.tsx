import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, type SharedValue } from 'react-native-reanimated';

import { ds } from '@/constants/ds';
import type { Category } from '@/lib/shopping-list';

export const INLINE_ROW_HEIGHT = 52;

interface InlineReorderOverlayProps {
  order: Category[];
  active: Category;
  /** Finger position and the overlay's top edge, both in window coordinates. */
  fingerY: SharedValue<number>;
  listTop: SharedValue<number>;
}

// While a category handle is held and dragged, the list collapses to these
// compact rows (dragging a six-item section around whole would be unwieldy);
// it expands back into the full list on release.
export function InlineReorderOverlay({ order, active, fingerY, listTop }: InlineReorderOverlayProps) {
  const activeIndex = order.indexOf(active);
  return (
    <View
      style={StyleSheet.absoluteFill}
      className="bg-surface-neutral-lightest px-layout-small pt-layout-xsmall">
      <View style={{ height: order.length * INLINE_ROW_HEIGHT }} className="w-full">
        {order.map((category, index) => (
          <OverlayRow
            key={category}
            category={category}
            index={index}
            count={order.length}
            activeIndex={activeIndex}
            isActive={category === active}
            fingerY={fingerY}
            listTop={listTop}
          />
        ))}
      </View>
    </View>
  );
}

interface OverlayRowProps {
  category: Category;
  index: number;
  count: number;
  activeIndex: number;
  isActive: boolean;
  fingerY: SharedValue<number>;
  listTop: SharedValue<number>;
}

function OverlayRow({ category, index, count, activeIndex, isActive, fingerY, listTop }: OverlayRowProps) {
  const animatedStyle = useAnimatedStyle(() => {
    // The overlay's inner stack starts one xsmall padding below its top edge.
    const stackTop = listTop.value + 8;
    if (isActive) {
      const raw = fingerY.value - stackTop - INLINE_ROW_HEIGHT / 2;
      const clamped = Math.max(0, Math.min((count - 1) * INLINE_ROW_HEIGHT, raw));
      return { transform: [{ translateY: clamped - index * INLINE_ROW_HEIGHT }], zIndex: 10 };
    }
    const hovered = Math.max(
      0,
      Math.min(count - 1, Math.floor((fingerY.value - stackTop) / INLINE_ROW_HEIGHT)),
    );
    let shift = 0;
    if (activeIndex < index && hovered >= index) shift = -1;
    if (activeIndex > index && hovered <= index) shift = 1;
    return {
      transform: [{ translateY: withSpring(shift * INLINE_ROW_HEIGHT, { damping: 22, stiffness: 220 }) }],
      zIndex: 0,
    };
  });

  return (
    <Animated.View
      style={[
        { position: 'absolute', top: index * INLINE_ROW_HEIGHT, height: INLINE_ROW_HEIGHT, width: '100%' },
        animatedStyle,
      ]}>
      <View
        className={
          'mb-comp-xsmall flex-1 flex-row items-center rounded-small px-comp-medium ' +
          (isActive ? 'bg-surface-neutral-lighter' : 'bg-surface-neutral-white')
        }>
        <Text className="flex-1 font-paragraph text-paragraph font-default text-text-default">
          {category}
        </Text>
        <MaterialIcons name="drag-handle" size={22} color={ds.colors.text.accent} />
      </View>
    </Animated.View>
  );
}
