import { MaterialIcons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ds } from '@/constants/ds';

import { ItemRow } from '@/components/shopping/item-row';
import type { ShoppingItem } from '@/lib/shopping-list';

interface CategoryGroupProps {
  title: string;
  items: ShoppingItem[];
  onToggle: (id: string) => void;
  onEdit: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
  onReorder: () => void;
}

export function CategoryGroup({
  title,
  items,
  onToggle,
  onEdit,
  onDelete,
  onReorder,
}: CategoryGroupProps) {
  if (items.length === 0) return null;
  return (
    <View className="w-full gap-layout-xsmall px-layout-small">
      <View className="w-full flex-row items-center">
        <Text className="flex-1 font-paragraph text-small font-emphasized text-text-default">
          {title}
        </Text>
        <Pressable
          onPress={onReorder}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Reorder categories">
          <MaterialIcons name="drag-handle" size={22} color={ds.colors.text.accent} />
        </Pressable>
      </View>
      <View className="w-full overflow-hidden rounded-large">
        {items.map((item, index) => (
          <Fragment key={item.id}>
            {index > 0 && <View className="h-px w-full bg-surface-neutral-lighter" />}
            <ItemRow
              item={item}
              onToggle={() => onToggle(item.id)}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item.id)}
            />
          </Fragment>
        ))}
      </View>
    </View>
  );
}
