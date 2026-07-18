import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { RecipeCard } from "@/components/recipes/recipe-card";
import { Chip } from "@/components/ui/chip";
import { ds } from "@/constants/ds";
import { BottomTabInset } from "@/constants/theme";
import { useHousehold } from "@/lib/household-context";
import {
  fetchRecipes,
  matchesSearch,
  setFavorite,
  type RecipeSummary,
} from "@/lib/recipes";

export default function RecipesListScreen() {
  const household = useHousehold();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // No realtime on recipes (deliberate) – refetch whenever the tab gains
  // focus so edits from other phones appear on the next visit.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchRecipes(household.id)
        .then((rows) => {
          if (!cancelled) setRecipes(rows);
        })
        .catch((error) => console.warn("[recipes] fetch failed", error));
      return () => {
        cancelled = true;
      };
    }, [household.id]),
  );

  const visible = useMemo(
    () =>
      (recipes ?? []).filter(
        (recipe) =>
          (!favoritesOnly || recipe.isFavorite) && matchesSearch(recipe, query),
      ),
    [recipes, favoritesOnly, query],
  );

  const toggleFavorite = (recipe: RecipeSummary) => {
    // Optimistic flip; shared household favorite (decided 2026-07-12).
    setRecipes(
      (current) =>
        current?.map((r) =>
          r.id === recipe.id ? { ...r, isFavorite: !r.isFavorite } : r,
        ) ?? null,
    );
    setFavorite(recipe.id, !recipe.isFavorite).catch((error) =>
      console.warn("[recipes] favorite failed", error),
    );
  };

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-surface-neutral-lightest"
    >
      <View className="w-full flex-row items-center gap-comp-small px-layout-small pb-layout-small">
        <Text className="flex-1 font-header text-display-4 font-emphasized leading-medium text-text-default">
          Recipes
        </Text>
        <Pressable
          onPress={() => router.push("/recipes/new")}
          accessibilityRole="button"
          accessibilityLabel="Add a recipe"
          hitSlop={8}
        >
          <MaterialIcons
            name="add"
            size={40}
            color={ds.colors.surface.primary.main}
          />
        </Pressable>
      </View>

      <View className="w-full gap-layout-small px-layout-small pb-layout-small">
        <SearchField value={query} onChangeText={setQuery} />
        <View className="w-full flex-row gap-comp-small">
          <Chip
            label="All"
            active={!favoritesOnly}
            onPress={() => setFavoritesOnly(false)}
          />
          <Chip
            label="Favorites"
            active={favoritesOnly}
            onPress={() => setFavoritesOnly(true)}
          />
        </View>
      </View>

      {recipes == null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={ds.colors.surface.primary.main} />
        </View>
      ) : recipes.length === 0 ? (
        <EmptyState onAdd={() => router.push("/recipes/new")} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(recipe) => recipe.id}
          numColumns={2}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          columnWrapperStyle={{ gap: 16, paddingHorizontal: 16 }}
          contentContainerStyle={{
            gap: 16,
            paddingBottom: insets.bottom + BottomTabInset + 24,
          }}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => router.push(`/recipes/${item.id}`)}
              onToggleFavorite={() => toggleFavorite(item)}
            />
          )}
          ListEmptyComponent={
            <Text className="px-layout-small py-layout-medium text-center font-paragraph text-paragraph font-default text-text-subtle">
              {favoritesOnly
                ? "No favorites match your search."
                : "No recipes match your search."}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

/** The design's search input (78:4184): leading icon inside the field. */
function SearchField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (text: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      className={
        "w-full flex-row items-center gap-comp-small rounded-medium p-comp-large " +
        (focused
          ? "border-2 border-forms-border-focused bg-forms-background-active"
          : "border border-forms-border-enabled bg-forms-background-default")
      }
    >
      <MaterialIcons name="search" size={24} color={ds.colors.icon.default} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search"
        placeholderTextColor={ds.colors.text.disabled}
        accessibilityLabel="Search recipes"
        autoCorrect={false}
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="flex-1 p-0 font-paragraph text-paragraph text-text-default"
      />
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="w-full px-layout-small">
      <View className="w-full rounded-large bg-surface-neutral-white p-layout-small">
        <MaterialIcons
          name="menu-book"
          size={40}
          color={ds.colors.surface.primary.main}
        />
        <View className="w-full gap-comp-small pt-layout-small">
          <Text className="font-header text-display-5 font-emphasized leading-small text-text-default">
            Nothing&apos;s cooking yet
          </Text>
          <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
            Save the dishes your family loves – one shared cookbook for
            everyone.
          </Text>
        </View>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          className="mt-layout-small w-full items-center rounded-medium border-2 border-button-outline-border-enabled py-comp-large"
        >
          <Text className="font-paragraph text-components-button-label font-default text-text-subtle">
            Add your first recipe
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
