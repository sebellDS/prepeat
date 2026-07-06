import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddItemInput } from '@/components/shopping/add-item-input';
import { CategoryGroup } from '@/components/shopping/category-group';
import { DoneSection } from '@/components/shopping/done-section';
import { EditItemSheet } from '@/components/shopping/edit-item-sheet';
import { EmptyState } from '@/components/shopping/empty-state';
import { LiveBadge } from '@/components/shopping/live-badge';
import { ReorderCategoriesSheet } from '@/components/shopping/reorder-categories-sheet';
import {
  ShoppingListProvider,
  useShoppingList,
  type ShoppingItem,
} from '@/lib/shopping-list';
import { BottomTabInset } from '@/constants/theme';

function ShoppingListScreen() {
  const {
    items,
    categoryOrder,
    addItem,
    toggleItem,
    updateItem,
    removeItem,
    fillFromWeeklyPlan,
    setCategoryOrder,
  } = useShoppingList();
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [reordering, setReordering] = useState(false);

  // A freshly checked item lingers in its category group (settled=false,
  // forgiving of accidental taps) before moving to the done section.
  const { groups, doneItems } = useMemo(() => {
    const active = items.filter((item) => !item.isChecked || !item.settled);
    const done = items
      .filter((item) => item.isChecked && item.settled)
      .sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0));
    return {
      groups: categoryOrder.map((category) => ({
        category,
        items: active.filter((item) => item.aisle === category),
      })),
      doneItems: done,
    };
  }, [items, categoryOrder]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-neutral-lighter">
      <View className="w-full flex-row items-center gap-comp-small px-layout-small pb-layout-small">
        <Text className="flex-1 font-header text-display-4 font-emphasized leading-medium text-text-default">
          Shopping list
        </Text>
        <LiveBadge />
      </View>

      <AddItemInput onSubmit={addItem} />

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: BottomTabInset + 56, gap: 16 }}>
        {items.length === 0 ? (
          <EmptyState onFillFromPlan={fillFromWeeklyPlan} />
        ) : (
          <>
            {groups.map(({ category, items: groupItems }) => (
              <CategoryGroup
                key={category}
                title={category}
                items={groupItems}
                onToggle={toggleItem}
                onEdit={setEditing}
                onDelete={removeItem}
                onReorder={() => setReordering(true)}
              />
            ))}
            <DoneSection
              items={doneItems}
              onToggle={toggleItem}
              onEdit={setEditing}
              onDelete={removeItem}
            />
          </>
        )}
      </ScrollView>

      <EditItemSheet
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(fields) => {
          if (editing) updateItem(editing.id, fields);
        }}
      />

      <ReorderCategoriesSheet
        visible={reordering}
        order={categoryOrder}
        onClose={() => setReordering(false)}
        onChange={setCategoryOrder}
      />
    </SafeAreaView>
  );
}

export default function ShoppingRoute() {
  return (
    <ShoppingListProvider>
      <ShoppingListScreen />
    </ShoppingListProvider>
  );
}
