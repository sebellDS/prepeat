import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { ds } from "@/constants/ds";
import type { RecipeSummary } from "@/lib/recipes";

/**
 * One tile in the two-column recipe grid (Figma list section 78:4010):
 * photo with a heart in the corner, name and total time below.
 */
export function RecipeCard({
  recipe,
  onPress,
  onToggleFavorite,
}: {
  recipe: RecipeSummary;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      className="flex-1 overflow-hidden rounded-large bg-surface-neutral-white"
    >
      <View className="h-[120px] w-full bg-surface-neutral-light">
        {recipe.imageUrl != null && (
          <Image
            source={{ uri: recipe.imageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        )}
        {recipe.imageUrl == null && (
          <View className="h-full w-full items-center justify-center">
            <MaterialIcons
              name="restaurant"
              size={32}
              color={ds.colors.text.disabled}
            />
          </View>
        )}
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            recipe.isFavorite
              ? `Remove ${recipe.title} from favorites`
              : `Favorite ${recipe.title}`
          }
          className="absolute right-comp-small top-comp-small"
        >
          <MaterialIcons
            name={recipe.isFavorite ? "favorite" : "favorite-border"}
            size={24}
            color={ds.colors.text.inverse}
          />
        </Pressable>
      </View>
      <View className="w-full gap-comp-small px-comp-small pb-layout-small pt-comp-xxsmall">
        <Text
          numberOfLines={1}
          className="font-header text-display-6 font-emphasized leading-xsmall text-text-accent"
        >
          {recipe.title}
        </Text>
        {recipe.totalMinutes != null && (
          <View className="w-full flex-row items-center gap-comp-small">
            <MaterialIcons
              name="schedule"
              size={16}
              color={ds.colors.icon.default}
            />
            <Text className="font-paragraph text-small font-default leading-xxsmall text-text-default">
              {recipe.totalMinutes} min
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
