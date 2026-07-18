import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddItemInput } from '@/components/shopping/add-item-input';
import { CategoryGroup } from '@/components/shopping/category-group';
import { DoneSection } from '@/components/shopping/done-section';
import { EditItemSheet } from '@/components/shopping/edit-item-sheet';
import { EmptyState } from '@/components/shopping/empty-state';
import {
  INLINE_ROW_HEIGHT,
  InlineReorderOverlay,
} from '@/components/shopping/inline-reorder-overlay';
import { LiveBadge } from '@/components/shopping/live-badge';
import { ReorderCategoriesSheet } from '@/components/shopping/reorder-categories-sheet';
import { WeekPicker } from '@/components/ui/week-picker';
import {
  ShoppingListProvider,
  useShoppingList,
  type Category,
  type ShoppingItem,
} from '@/lib/shopping-list';
import { BottomTabInset } from '@/constants/theme';

function ShoppingListScreen() {
  const {
    loading,
    live,
    items,
    categoryOrder,
    userId,
    viewedWeekStart,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    addItem,
    toggleItem,
    updateItem,
    removeItem,
    clearCompleted,
    fillFromWeeklyPlan,
    setCategoryOrder,
    retry,
  } = useShoppingList();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [reordering, setReordering] = useState(false);
  // Inline category drag: hold a group's handle, the list collapses to
  // compact rows, drag, release. A plain tap on the handle opens the sheet.
  const [dragging, setDragging] = useState<Category | null>(null);
  const fingerY = useSharedValue(0);
  const listTop = useSharedValue(0);
  const listAreaRef = useRef<View>(null);

  // A freshly checked item lingers in its category group (settled=false,
  // forgiving of accidental taps) before moving to the done section.
  const { uncategorized, groups, doneItems } = useMemo(() => {
    const active = items.filter((item) => !item.isChecked || !item.settled);
    const done = items
      .filter((item) => item.isChecked && item.settled)
      .sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0));
    return {
      // Items the household has not categorized yet stay at the top, right
      // where they were typed, until they are taught a category.
      uncategorized: active.filter((item) => item.aisle == null),
      groups: categoryOrder.map((category) => ({
        category,
        items: active.filter((item) => item.aisle === category),
      })),
      doneItems: done,
    };
  }, [items, categoryOrder]);

  const commitInlineDrag = (category: Category) => {
    const hovered = Math.max(
      0,
      Math.min(
        categoryOrder.length - 1,
        Math.floor((fingerY.value - listTop.value - 8) / INLINE_ROW_HEIGHT),
      ),
    );
    const from = categoryOrder.indexOf(category);
    if (from !== -1 && hovered !== from) {
      const next = [...categoryOrder];
      next.splice(hovered, 0, ...next.splice(from, 1));
      setCategoryOrder(next);
    }
    setDragging(null);
  };

  const stopInlineDrag = () => setDragging(null);

  const makeDragGesture = (category: Category) =>
    Gesture.Pan()
      .activateAfterLongPress(180)
      .onStart((event) => {
        fingerY.value = event.absoluteY;
        runOnJS(setDragging)(category);
      })
      .onUpdate((event) => {
        fingerY.value = event.absoluteY;
      })
      .onEnd(() => {
        runOnJS(commitInlineDrag)(category);
      })
      .onFinalize((_event, success) => {
        if (!success) {
          runOnJS(stopInlineDrag)();
        }
      });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-neutral-lightest">
      <View className="w-full flex-row items-center gap-comp-small px-layout-small pb-layout-small">
        <Text className="flex-1 font-header text-display-4 font-emphasized leading-medium text-text-default">
          Shopping list
        </Text>
        <LiveBadge />
      </View>

      {/* Every week has its own list (designed 2026-07-16). Same weekNav
          as the Plan tab (Figma 163:38970, aligned 2026-07-18). */}
      <View className="w-full px-layout-small pb-layout-small">
        <WeekPicker
          weekStart={viewedWeekStart}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={goBack}
          onForward={goForward}
        />
      </View>

      <AddItemInput onSubmit={addItem} />

      <View
        ref={listAreaRef}
        className="flex-1"
        onLayout={() => {
          listAreaRef.current?.measureInWindow((_x, y) => {
            listTop.value = y;
          });
        }}>
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          // The add-input keeps the keyboard up for entering several items;
          // scrolling the list is the natural "I'm done typing, now I'm
          // shopping" signal, so it puts the keyboard away (in-store
          // feedback, 2026-07-09).
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingBottom: insets.bottom + BottomTabInset + 56,
            gap: 16,
          }}>
          {items.length === 0 ? (
            loading && live === 'offline' ? (
              // The initial load failed (launch-time outage). Offer a retry
              // instead of a permanent blank; the tab also retries itself on
              // foreground once the connection is back.
              <LoadFailed onRetry={retry} />
            ) : (
              // While the first fetch is in flight the list area stays blank –
              // flashing the empty state at a household with items would lie.
              !loading && <EmptyState onFillFromPlan={fillFromWeeklyPlan} />
            )
          ) : (
            <>
              <CategoryGroup
                items={uncategorized}
                onToggle={toggleItem}
                onEdit={setEditing}
                onDelete={removeItem}
              />
              {groups.map(({ category, items: groupItems }) => (
                <CategoryGroup
                  key={category}
                  title={category}
                  items={groupItems}
                  onToggle={toggleItem}
                  onEdit={setEditing}
                  onDelete={removeItem}
                  onReorder={() => setReordering(true)}
                  dragGesture={makeDragGesture(category)}
                />
              ))}
              <DoneSection
                items={doneItems}
                currentUserId={userId}
                onToggle={toggleItem}
                onEdit={setEditing}
                onDelete={removeItem}
                onClear={clearCompleted}
              />
            </>
          )}
        </ScrollView>

        {dragging != null && (
          <InlineReorderOverlay
            order={categoryOrder}
            active={dragging}
            fingerY={fingerY}
            listTop={listTop}
          />
        )}
      </View>

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

/**
 * Shown when the shopping list's first load fails (no connection at launch).
 * Improvised – no Figma design for this offline state yet (flagged in the
 * backlog), matched to the launch retry screen in _layout.tsx.
 */
function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="items-center gap-layout-medium px-layout-large py-layout-large">
      <View className="w-full items-center gap-comp-small">
        <Text className="text-center font-header text-display-6 font-emphasized leading-medium text-text-default">
          Can&apos;t load your list
        </Text>
        <Text className="text-center font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
          Check your connection and try again – nothing on your list is lost.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        className="items-center rounded-medium bg-button-solid-fill-enabled px-comp-xlarge py-comp-large">
        <Text className="font-paragraph text-paragraph font-default leading-xsmall text-button-solid-label-enabled">
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

export default function ShoppingRoute() {
  return (
    <ShoppingListProvider>
      <ShoppingListScreen />
    </ShoppingListProvider>
  );
}
