import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { SwipeHint, SwipeRowProvider } from "@/components/ui/swipe-hint";
import { ds } from "@/constants/ds";
import { type PlanEntry } from "@/lib/meal-plan";

/**
 * One planned meal in a day row (Figma recipe row 147:24404). Swiping left
 * reveals the four edit actions (Figma 147:24725): move to another day,
 * swap meal, change servings, remove.
 *
 * Manual meals ("Leftovers", 2026-07-18) have no recipe: no design exists
 * for their row yet, so they borrow the recipe row with the placeholder
 * icon, no servings line, and no change-servings action (servings are
 * meaningless without ingredients) – flagged in the backlog.
 */
export function MealRow({
  entry,
  onPress,
  onMove,
  onSwap,
  onServings,
  onRemove,
}: {
  entry: PlanEntry;
  /** Tap opens the recipe (feedback 2026-07-16). */
  onPress: () => void;
  onMove: () => void;
  onSwap: () => void;
  onServings: () => void;
  onRemove: () => void;
}) {
  const isManual = entry.recipeId == null;
  const swipeable = useRef<SwipeableMethods>(null);
  // Same guard as the shopping rows: while a swipe is engaged, a tap only
  // closes the actions – it never navigates.
  const swipeEngaged = useRef(false);
  const act = (action: () => void) => () => {
    swipeable.current?.close();
    action();
  };
  const handlePress = () => {
    if (swipeEngaged.current) {
      swipeable.current?.close();
      return;
    }
    onPress();
  };

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
          <SwipeAction
            icon="edit-calendar"
            label="Move to another day"
            onPress={act(onMove)}
          />
          <SwipeAction icon="repeat" label="Swap meal" onPress={act(onSwap)} />
          {!isManual && (
            <SwipeAction
              icon="people-alt"
              label="Change servings"
              onPress={act(onServings)}
            />
          )}
          <SwipeAction
            icon="delete"
            label="Remove meal"
            destructive
            onPress={act(onRemove)}
          />
        </View>
      )}
    >
      <SwipeRowProvider open={() => swipeable.current?.openRight()}>
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={
            isManual ? entry.recipeTitle : `Open ${entry.recipeTitle}`
          }
          className="w-full flex-row items-center gap-comp-small border-b border-border-subtle bg-surface-neutral-white py-comp-small pl-comp-small pr-comp-large"
        >
          {entry.recipeImageUrl ? (
            <Image
              source={{ uri: entry.recipeImageUrl }}
              style={{ width: 40, height: 40, borderRadius: 8 }}
              contentFit="cover"
            />
          ) : (
            <View className="h-[40px] w-[40px] items-center justify-center rounded-small bg-surface-neutral-lighter">
              <MaterialIcons
                name="restaurant"
                size={20}
                color={ds.colors.icon.subtle}
              />
            </View>
          )}
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={1}
              className="font-header text-display-6 font-emphasized leading-xsmall text-text-accent"
            >
              {entry.recipeTitle}
            </Text>
            {!isManual && (
              <View className="flex-row items-center gap-comp-small">
                <MaterialIcons
                  name="people-alt"
                  size={16}
                  color={ds.colors.icon.default}
                />
                <Text className="font-paragraph text-small font-default leading-xxsmall text-text-default">
                  {entry.servings} servings
                </Text>
              </View>
            )}
          </View>
          <SwipeHint />
        </Pressable>
      </SwipeRowProvider>
    </ReanimatedSwipeable>
  );
}

function SwipeAction({
  icon,
  label,
  destructive = false,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={
        "h-full w-[56px] items-center justify-center " +
        (destructive ? "bg-error-main" : "bg-surface-neutral-lighter")
      }
    >
      <MaterialIcons
        name={icon}
        size={24}
        color={
          destructive
            ? ds.colors.error["contrast-text"]
            : ds.colors.icon.default
        }
      />
    </Pressable>
  );
}
