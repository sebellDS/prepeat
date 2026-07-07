import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { ds } from '@/constants/ds';

import { ItemRow } from '@/components/shopping/item-row';
import type { ShoppingItem } from '@/lib/shopping-list';

interface DoneSectionProps {
  items: ShoppingItem[];
  onToggle: (id: string) => void;
  onEdit: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
  /** Soft-deletes everything in this section (strategy: manual clear). */
  onClear: () => void;
}

export function DoneSection({ items, onToggle, onEdit, onDelete, onClear }: DoneSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;
  const label = `${items.length} ${items.length === 1 ? 'item' : 'items'} done`;
  return (
    <Animated.View layout={LinearTransition.duration(250)} exiting={FadeOut.duration(150)}>
      {/* The band paints far past its layout box (padding + negative margin
          cancel out) so the darker background runs to the bottom of the
          viewport and through bottom overscroll. */}
      <View
        className="w-full gap-layout-xsmall bg-surface-neutral-light px-layout-small pt-layout-xsmall"
        style={{ paddingBottom: 1000, marginBottom: -1000 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={collapsed ? `Show ${label}` : `Hide ${label}`}
          onPress={() => setCollapsed((value) => !value)}
          hitSlop={8}
          className="w-full flex-row items-center gap-layout-small py-comp-xsmall">
          <Text className="flex-1 font-paragraph text-small font-emphasized text-text-default">
            {label}
          </Text>
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear completed items">
            <Text className="font-paragraph text-small font-emphasized text-text-accent">
              Clear
            </Text>
          </Pressable>
          <SymbolView
            name={collapsed ? 'chevron.down' : 'chevron.up'}
            size={16}
            tintColor={ds.colors.icon.default}
          />
        </Pressable>
        {!collapsed && (
          <View className="w-full overflow-hidden rounded-large">
            {items.map((item, index) => (
              <Animated.View
                key={item.id}
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                layout={LinearTransition.duration(250)}>
                {index > 0 && <View className="h-px w-full bg-surface-neutral-lighter" />}
                <ItemRow
                  item={item}
                  showInitial
                  onToggle={() => onToggle(item.id)}
                  onEdit={() => onEdit(item)}
                  onDelete={() => onDelete(item.id)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}
