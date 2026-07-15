import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EditIngredientSheet } from "@/components/recipes/edit-ingredient-sheet";
import { EditStepSheet } from "@/components/recipes/edit-step-sheet";
import { ReorderSheet } from "@/components/recipes/reorder-sheet";
import { ServingsCounter } from "@/components/recipes/servings-counter";
import { SwipeActions } from "@/components/recipes/swipe-actions";
import { ds } from "@/constants/ds";
import { BottomTabInset } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/household-context";
import {
  addIngredientsToShoppingList,
  deleteIngredient,
  deleteStep,
  fetchRecipe,
  reorderIngredients,
  reorderSteps,
  scaledQuantityText,
  setFavorite,
  softDeleteRecipe,
  totalMinutes,
  type Recipe,
  type RecipeIngredient,
  type RecipeStep,
} from "@/lib/recipes";

type Dialog = "delete" | "shopping" | null;

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const household = useHousehold();
  const { session } = useAuth();
  const router = useRouter();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [servings, setServings] = useState<number | null>(null);
  // Cooking mode: checked-off ingredients/steps live on this phone only –
  // they are progress through tonight's cooking, not shared state.
  const [doneIngredients, setDoneIngredients] = useState<Set<string>>(
    new Set(),
  );
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editingIngredient, setEditingIngredient] = useState<
    RecipeIngredient | "new" | null
  >(null);
  const [editingStep, setEditingStep] = useState<RecipeStep | "new" | null>(
    null,
  );
  const [reordering, setReordering] = useState<"ingredients" | "steps" | null>(
    null,
  );

  const reload = useCallback(async () => {
    try {
      const fresh = await fetchRecipe(id);
      setRecipe(fresh);
      setServings((current) => current ?? fresh.servings);
    } catch (error) {
      console.warn("[recipes] detail fetch failed", error);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (recipe == null) {
    return (
      <SafeAreaView
        edges={["top"]}
        className="flex-1 items-center justify-center bg-surface-neutral-lightest"
      >
        <ActivityIndicator color={ds.colors.surface.primary.main} />
      </SafeAreaView>
    );
  }

  const chosenServings = servings ?? recipe.servings;
  const total = totalMinutes(recipe.prepMinutes, recipe.cookMinutes);

  const toggleFavorite = () => {
    setRecipe({ ...recipe, isFavorite: !recipe.isFavorite });
    setFavorite(recipe.id, !recipe.isFavorite).catch((error) =>
      console.warn("[recipes] favorite failed", error),
    );
  };

  const confirmDialog = async () => {
    try {
      if (dialog === "delete") {
        await softDeleteRecipe(recipe.id);
        setDialog(null);
        router.back();
        return;
      }
      if (dialog === "shopping") {
        await addIngredientsToShoppingList(
          recipe,
          chosenServings,
          household.id,
          session?.user?.id ?? "",
        );
      }
    } catch (error) {
      console.warn("[recipes] action failed", error);
    }
    setDialog(null);
  };

  const menuItems: {
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    onPress: () => void;
  }[] = [
    {
      icon: recipe.isFavorite ? "favorite" : "favorite-border",
      label: recipe.isFavorite ? "Remove from favorites" : "Add to favorites",
      onPress: toggleFavorite,
    },
    // "Add recipe to weekly plan" joins this menu when the Plan tab exists.
    {
      icon: "shopping-bag",
      label: "Add ingredients to shopping list",
      onPress: () => setDialog("shopping"),
    },
    {
      icon: "add",
      label: "Add ingredient to this recipe",
      onPress: () => setEditingIngredient("new"),
    },
    {
      icon: "add",
      label: "Add instruction to this recipe",
      onPress: () => setEditingStep("new"),
    },
    {
      icon: "delete",
      label: "Delete recipe",
      onPress: () => setDialog("delete"),
    },
  ];

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-surface-neutral-lightest"
    >
      <View className="w-full flex-row items-center justify-between px-layout-small py-comp-small">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MaterialIcons
            name="arrow-back"
            size={32}
            color={ds.colors.surface.primary.main}
          />
        </Pressable>
        <Pressable
          onPress={() => setMenuOpen((open) => !open)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Recipe actions"
        >
          <MaterialIcons
            name="more-horiz"
            size={28}
            color={ds.colors.icon.default}
          />
        </Pressable>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: BottomTabInset + 24 }}
        onScrollBeginDrag={() => setMenuOpen(false)}
      >
        {/* Photo header with back, overflow menu and the favorite heart. */}
        <View className="h-[320px] w-full bg-surface-neutral-light">
          {recipe.imageUrl != null && (
            <Image
              source={{ uri: recipe.imageUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          )}
          <Pressable
            onPress={toggleFavorite}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              recipe.isFavorite ? "Remove from favorites" : "Add to favorites"
            }
            style={{ position: "absolute", top: 16, right: 16 }}
          >
            <MaterialIcons
              name={recipe.isFavorite ? "favorite" : "favorite-border"}
              size={40}
              color={ds.colors.text.inverse}
            />
          </Pressable>
        </View>

        <View className="w-full gap-layout-small px-layout-small py-layout-small">
          <View className="w-full gap-comp-small">
            <Text className="font-header text-display-5 font-emphasized leading-small text-text-subtle">
              {recipe.title}
            </Text>
            {recipe.description != null && recipe.description.length > 0 && (
              <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
                {recipe.description}
              </Text>
            )}
            <View className="w-full flex-row gap-comp-small">
              <MetaItem icon="schedule" label="Total" value={total} />
              <MetaItem
                icon="restaurant"
                label="Prep"
                value={recipe.prepMinutes}
              />
              <MetaItem
                icon="local-fire-department"
                label="Cook"
                value={recipe.cookMinutes}
              />
            </View>
          </View>

          <ServingsCounter value={chosenServings} onChange={setServings} />

          <View className="w-full gap-comp-xsmall">
            <View className="w-full flex-row items-center">
              <Text className="flex-1 font-header text-display-6 font-emphasized leading-xsmall text-text-default">
                Ingredients
              </Text>
              {recipe.ingredients.length > 1 && (
                <Pressable
                  onPress={() => setReordering("ingredients")}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Reorder ingredients"
                >
                  <MaterialIcons
                    name="drag-handle"
                    size={24}
                    color={ds.colors.text.accent}
                  />
                </Pressable>
              )}
            </View>
            <View className="w-full overflow-hidden rounded-large">
              {recipe.ingredients.map((ingredient, index) => (
                <IngredientRow
                  key={ingredient.id}
                  ingredient={ingredient}
                  divider={index > 0}
                  quantityText={scaledQuantityText(
                    ingredient,
                    recipe.servings,
                    chosenServings,
                  )}
                  done={doneIngredients.has(ingredient.id)}
                  onToggle={() =>
                    setDoneIngredients((current) =>
                      toggleInSet(current, ingredient.id),
                    )
                  }
                  onEdit={() => setEditingIngredient(ingredient)}
                  onDelete={async () => {
                    await deleteIngredient(ingredient.id).catch((error) =>
                      console.warn("[recipes] delete ingredient failed", error),
                    );
                    reload();
                  }}
                />
              ))}
              {recipe.ingredients.length === 0 && (
                <EmptyRowHint text="No ingredients yet – add the first one below." />
              )}
            </View>
          </View>

          <View className="w-full gap-comp-xsmall">
            <View className="w-full flex-row items-center">
              <Text className="flex-1 font-header text-display-6 font-emphasized leading-xsmall text-text-default">
                Instructions
              </Text>
              {recipe.steps.length > 1 && (
                <Pressable
                  onPress={() => setReordering("steps")}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Reorder instructions"
                >
                  <MaterialIcons
                    name="drag-handle"
                    size={24}
                    color={ds.colors.text.accent}
                  />
                </Pressable>
              )}
            </View>
            <View className="w-full overflow-hidden rounded-large">
              {recipe.steps.map((step, index) => (
                <StepRow
                  key={step.id}
                  step={step}
                  divider={index > 0}
                  done={doneSteps.has(step.id)}
                  onToggle={() =>
                    setDoneSteps((current) => toggleInSet(current, step.id))
                  }
                  onEdit={() => setEditingStep(step)}
                  onDelete={async () => {
                    await deleteStep(recipe.id, step.id).catch((error) =>
                      console.warn("[recipes] delete step failed", error),
                    );
                    reload();
                  }}
                />
              ))}
              {recipe.steps.length === 0 && (
                <EmptyRowHint text="No instructions yet – add the first step below." />
              )}
            </View>
          </View>

          {/* Edit the recipe's facts (name, photo, times, servings) –
              requested back after the menu item was removed (2026-07-12). */}
          <Pressable
            onPress={() => router.push(`/recipes/new?id=${recipe.id}`)}
            accessibilityRole="button"
            className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium border border-button-outline-border-enabled py-comp-large"
          >
            <MaterialIcons
              name="edit-note"
              size={24}
              color={ds.colors.icon.default}
            />
            <Text className="font-paragraph text-components-button-label font-default text-text-subtle">
              Edit recipe
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {menuOpen && (
        <View className="absolute right-layout-small top-[52px] w-[260px] overflow-hidden rounded-large bg-surface-neutral-white shadow-lg">
          {menuItems.map((item, index) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              onPress={() => {
                setMenuOpen(false);
                item.onPress();
              }}
              className={
                "w-full flex-row items-center gap-comp-small px-comp-large py-comp-medium" +
                (index > 0 ? " border-t border-surface-neutral-lighter" : "")
              }
            >
              <MaterialIcons
                name={item.icon}
                size={20}
                color={ds.colors.icon.default}
              />
              <Text className="flex-1 font-paragraph text-components-label font-default text-text-default">
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <ConfirmSheet
        visible={dialog != null}
        title={
          dialog === "delete"
            ? "Delete recipe"
            : "Add ingredients to shopping list"
        }
        body={
          dialog === "delete"
            ? "You are about to delete a recipe from your household. This action cannot be undone."
            : `Add this recipe's ingredients for ${chosenServings} people to the shopping list? You can also do this from your weekly plan.`
        }
        confirmLabel={dialog === "delete" ? "Delete recipe" : "Add ingredients"}
        destructive={dialog === "delete"}
        onCancel={() => setDialog(null)}
        onConfirm={confirmDialog}
      />

      <ReorderSheet
        visible={reordering != null}
        title={
          reordering === "steps"
            ? "Reorder instructions"
            : "Reorder ingredients"
        }
        hint="Drag to change the order."
        items={
          reordering === "steps"
            ? recipe.steps.map((step) => ({
                key: step.id,
                label: `${step.stepNumber}. ${step.text}`,
              }))
            : recipe.ingredients.map((ingredient) => ({
                key: ingredient.id,
                label: ingredient.name,
              }))
        }
        onClose={() => setReordering(null)}
        onChange={(orderedKeys) => {
          // Optimistic local reorder, then persist.
          if (reordering === "steps") {
            const byId = new Map(recipe.steps.map((step) => [step.id, step]));
            setRecipe({
              ...recipe,
              steps: orderedKeys.map((key, index) => ({
                ...byId.get(key)!,
                stepNumber: index + 1,
              })),
            });
            reorderSteps(orderedKeys).catch((error) => {
              console.warn("[recipes] reorder steps failed", error);
              reload();
            });
          } else {
            const byId = new Map(
              recipe.ingredients.map((ingredient) => [
                ingredient.id,
                ingredient,
              ]),
            );
            setRecipe({
              ...recipe,
              ingredients: orderedKeys.map((key, index) => ({
                ...byId.get(key)!,
                sortOrder: index,
              })),
            });
            reorderIngredients(orderedKeys).catch((error) => {
              console.warn("[recipes] reorder ingredients failed", error);
              reload();
            });
          }
        }}
      />

      <EditIngredientSheet
        state={editingIngredient}
        recipeId={recipe.id}
        nextSortOrder={recipe.ingredients.length}
        onClose={() => setEditingIngredient(null)}
        onSaved={() => {
          setEditingIngredient(null);
          reload();
        }}
      />

      <EditStepSheet
        state={editingStep}
        recipeId={recipe.id}
        stepCount={recipe.steps.length}
        onClose={() => setEditingStep(null)}
        onSaved={() => {
          setEditingStep(null);
          reload();
        }}
      />
    </SafeAreaView>
  );
}

function toggleInSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: number | null;
}) {
  if (value == null) return null;
  return (
    <View className="flex-1 flex-row items-center gap-layout-xxsmall">
      <MaterialIcons name={icon} size={16} color={ds.colors.icon.default} />
      <Text className="font-paragraph text-small font-emphasized text-text-default">
        {label}
      </Text>
      <Text className="font-paragraph text-small font-default text-text-subtle">
        {value} min
      </Text>
    </View>
  );
}

function EmptyRowHint({ text }: { text: string }) {
  return (
    <View className="w-full bg-surface-neutral-white p-layout-small">
      <Text className="font-paragraph text-paragraph font-default text-text-subtle">
        {text}
      </Text>
    </View>
  );
}

function IngredientRow({
  ingredient,
  quantityText,
  divider,
  done,
  onToggle,
  onEdit,
  onDelete,
}: {
  ingredient: RecipeIngredient;
  quantityText: string | null;
  divider: boolean;
  done: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View>
      <SwipeActions label={ingredient.name} onEdit={onEdit} onDelete={onDelete}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={ingredient.name}
          className="w-full flex-row items-center gap-comp-small border-b border-border-subtle bg-surface-neutral-white p-layout-small"
        >
          {done && (
            <MaterialIcons
              name="check"
              size={18}
              color={ds.colors.surface.primary.main}
            />
          )}
          <Text
            className={
              "flex-1 font-paragraph text-paragraph font-default " +
              (done ? "text-text-subtle line-through" : "text-text-default")
            }
          >
            {ingredient.name}
          </Text>
          {quantityText != null && (
            <Text className="font-paragraph text-paragraph font-default text-text-subtle">
              {quantityText}
            </Text>
          )}
        </Pressable>
      </SwipeActions>
    </View>
  );
}

function StepRow({
  step,
  divider,
  done,
  onToggle,
  onEdit,
  onDelete,
}: {
  step: RecipeStep;
  divider: boolean;
  done: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View>
      <SwipeActions
        label={`step ${step.stepNumber}`}
        onEdit={onEdit}
        onDelete={onDelete}
      >
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`Step ${step.stepNumber}`}
          className="w-full flex-row items-start gap-comp-small border-b border-border-subtle bg-surface-neutral-white p-layout-small"
        >
          <View
            className={
              "size-[32px] items-center justify-center rounded-xlarge " +
              (done
                ? "bg-surface-primary-main"
                : "border border-border bg-surface-neutral-lightest")
            }
          >
            {done ? (
              <MaterialIcons
                name="check"
                size={18}
                color={ds.colors.text.inverse}
              />
            ) : (
              <Text className="font-paragraph text-small font-emphasized text-text-default">
                {step.stepNumber}
              </Text>
            )}
          </View>
          <Text
            style={{ paddingTop: 4 }}
            className={
              "min-w-0 flex-1 font-paragraph text-paragraph font-default leading-xsmall " +
              (done ? "text-text-subtle" : "text-text-default")
            }
          >
            {step.text}
          </Text>
        </Pressable>
      </SwipeActions>
    </View>
  );
}

/** Bottom-sheet confirmation matching the Figma action dialogs. */
function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // A real Modal so the sheet floats above the native tab bar (it used to
  // hide the confirm button behind it).
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable
        className="flex-1 bg-black/30"
        onPress={onCancel}
        accessibilityLabel="Cancel"
      />
      <View className="w-full gap-layout-small rounded-t-xlarge bg-surface-neutral-white p-layout-small pb-layout-large">
        <Text className="font-header text-display-5 font-emphasized text-text-default">
          {title}
        </Text>
        <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
          {body}
        </Text>
        {/* Cancel above the destructive action, per the Figma dialogs. */}
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          className="w-full items-center rounded-medium border border-button-outline-border-enabled py-comp-large"
        >
          <Text className="font-paragraph text-components-button-label font-default text-text-subtle">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          accessibilityRole="button"
          className={
            "w-full items-center rounded-medium py-comp-large " +
            (destructive ? "bg-error-main" : "bg-button-solid-fill-enabled")
          }
        >
          <Text
            className={
              "font-paragraph text-components-button-label font-default " +
              (destructive
                ? "text-error-contrast-text"
                : "text-button-solid-label-enabled")
            }
          >
            {confirmLabel}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
