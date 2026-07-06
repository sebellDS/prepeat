import { SymbolView } from 'expo-symbols';
import { Fragment, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ds } from '@/constants/ds';

import { ItemRow } from '@/components/shopping/item-row';
import type { ShoppingItem } from '@/lib/shopping-list';

interface DoneSectionProps {
  items: ShoppingItem[];
  onToggle: (id: string) => void;
  onEdit: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
}

export function DoneSection({ items, onToggle, onEdit, onDelete }: DoneSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;
  const label = `${items.length} ${items.length === 1 ? 'item' : 'items'} done`;
  return (
    // The band paints far past its layout box (padding + negative margin
    // cancel out) so the darker background runs to the bottom of the
    // viewport and through bottom overscroll.
    <View
      className="w-full gap-layout-xsmall bg-surface-neutral-light px-layout-small pt-layout-xsmall"
      style={{ paddingBottom: 1000, marginBottom: -1000 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={collapsed ? `Show ${label}` : `Hide ${label}`}
        onPress={() => setCollapsed((value) => !value)}
        hitSlop={8}
        className="w-full flex-row items-center py-comp-xsmall">
        <Text className="flex-1 font-paragraph text-small font-emphasized text-text-default">
          {label}
        </Text>
        <SymbolView
          name={collapsed ? 'chevron.down' : 'chevron.up'}
          size={16}
          tintColor={ds.colors.icon.default}
        />
      </Pressable>
      {!collapsed && (
        <View className="w-full overflow-hidden rounded-large">
          {items.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 && <View className="h-px w-full bg-surface-neutral-lighter" />}
              <ItemRow
                item={item}
                showInitial
                onToggle={() => onToggle(item.id)}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item.id)}
              />
            </Fragment>
          ))}
        </View>
      )}
    </View>
  );
}
