import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  useFocusEffect,
  useLocalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";
import { Fragment, useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { IngredientSheet } from "@/components/recipes/ingredient-sheet";
import { StepSheet } from "@/components/recipes/step-sheet";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { LoadError } from "@/components/ui/load-error";
import { ReorderSheet } from "@/components/ui/reorder-sheet";
import { ServingsCounter } from "@/components/recipes/servings-counter";
import { SwipeActions } from "@/components/recipes/swipe-actions";
import { SwipeHint } from "@/components/ui/swipe-hint";
import { UndoToast } from "@/components/ui/undo-toast";
import { ds } from "@/constants/ds";
import { Spacing, tabBarClearance } from "@/constants/theme";
import { AddToPlanSheet } from "@/components/recipes/add-to-plan-sheet";
import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/household-context";
import { addRecipeToPlan } from "@/lib/meal-plan";
import {
  addIngredient,
  addIngredientsToShoppingList,
  addStep,
  deleteIngredient,
  deleteStep,
  fetchRecipe,
  groupBySection,
  reorderIngredients,
  reorderSteps,
  scaledQuantityText,
  setFavorite,
  softDeleteRecipe,
  sourceLabel,
  totalMinutes,
  updateIngredient,
  updateStep,
  type Recipe,
  type RecipeIngredient,
  type RecipeStep,
} from "@/lib/recipes";

type Dialog = "delete" | "shopping" | null;

// A just-deleted ingredient or step, kept so the undo toast can re-insert it.
// These are hard deletes (no deleted_at), so undo re-adds from the snapshot.
type UndoTarget =
  | { kind: "ingredient"; snapshot: RecipeIngredient }
  | { kind: "step"; snapshot: RecipeStep };

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const household = useHousehold();
  const { session } = useAuth();
  const router = useRouter();
  // This screen is mounted in two stacks (2026-07-18): /recipes/[id] on
  // the Recipes tab and /recipe/[id] inside the Plan tab.
  const inPlanTab = usePathname().startsWith("/recipe/");
  const insets = useSafeAreaInsets();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [failed, setFailed] = useState(false);
  const [servings, setServings] = useState<number | null>(null);
  // Cooking mode: checked-off ingredients/steps live on this phone only –
  // they are progress through tonight's cooking, not shared state.
  const [doneIngredients, setDoneIngredients] = useState<Set<string>>(
    new Set(),
  );
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  // The actions dropdown top-aligns with the "⋯" icon. The dropdown is
  // absolutely positioned from the SCREEN frame, so we need the icon's window
  // Y (measureInWindow), not its offset inside the header – measuring the
  // latter put it up in the status bar (Thomas, 2026-07-25). 52 is the
  // pre-measure fallback.
  const moreButtonRef = useRef<View>(null);
  const [menuTop, setMenuTop] = useState(52);
  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    moreButtonRef.current?.measureInWindow((_x, y) => setMenuTop(y));
    setMenuOpen(true);
  };
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editingIngredient, setEditingIngredient] = useState<
    RecipeIngredient | "new" | null
  >(null);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<RecipeStep | "new" | null>(
    null,
  );
  const [reordering, setReordering] = useState<"ingredients" | "steps" | null>(
    null,
  );
  const [undoTarget, setUndoTarget] = useState<UndoTarget | null>(null);
  // Stable so the toast's auto-dismiss timer doesn't reset on every re-render.
  const dismissUndo = useCallback(() => setUndoTarget(null), []);

  const reload = useCallback(async () => {
    setFailed(false);
    try {
      const fresh = await fetchRecipe(id);
      setRecipe(fresh);
      setServings((current) => current ?? fresh.servings);
    } catch (error) {
      console.warn("[recipes] detail fetch failed", error);
      setFailed(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (recipe == null) {
    // Both states carry the header: without it a failed load (offline, or a
    // recipe another member just deleted) left the screen with no Back button
    // and no way out at all – the audit's "strand the user" case.
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-surface-neutral-lightest">
        <View className="w-full flex-row items-center px-layout-small py-comp-small">
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
        </View>
        {failed ? (
          <LoadError
            title="Can't load this recipe"
            message="We couldn't open this recipe. Check your connection and try again – nothing in it is lost."
            onRetry={reload}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={ds.colors.surface.primary.main} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  const chosenServings = servings ?? recipe.servings;
  const total = totalMinutes(recipe.prepMinutes, recipe.cookMinutes);
  // Pulled out of `recipe` so the press handler below closes over a value
  // TypeScript knows is non-null.
  const sourceUrl = recipe.sourceUrl;

  const toggleFavorite = () => {
    setRecipe({ ...recipe, isFavorite: !recipe.isFavorite });
    setFavorite(recipe.id, !recipe.isFavorite).catch((error) =>
      console.warn("[recipes] favorite failed", error),
    );
  };

  // Reachable from both the "⋯" menu and the button at the bottom of the
  // page. Edit stays in the stack we're rendered in: /recipes/[id] on the
  // Recipes tab, /recipe/[id] when opened from the Plan tab (2026-07-18) – so
  // saving lands back on this detail via back().
  const openEdit = () =>
    router.push(`${inPlanTab ? "/recipe" : "/recipes"}/new?id=${recipe.id}`);

  // Undo a swipe-delete: re-insert the snapshot (ingredient by sort order,
  // step at its old position), then reload from the server truth.
  const undoDelete = async () => {
    if (undoTarget == null) return;
    const target = undoTarget;
    setUndoTarget(null);
    try {
      if (target.kind === "ingredient") {
        await addIngredient(
          recipe.id,
          target.snapshot.name,
          target.snapshot.quantityText,
          target.snapshot.sortOrder,
        );
      } else {
        await addStep(recipe.id, target.snapshot.stepNumber, target.snapshot.text);
      }
    } catch (error) {
      console.warn("[recipes] undo delete failed", error);
    }
    reload();
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
    {
      icon: "date-range",
      label: "Add to weekly plan",
      onPress: () => setPlanSheetOpen(true),
    },
    {
      icon: "shopping-bag",
      label: "Add ingredients to shopping list",
      onPress: () => setDialog("shopping"),
    },
    // "Add ingredient/instruction" left this menu 2026-07-16 (feedback):
    // ingredients and steps are edited inline on the lists below. Edit recipe
    // joined it 2026-07-27 (Thomas) – it keeps its button at the bottom of the
    // page too, so it is reachable without scrolling the whole recipe.
    {
      icon: "edit-note",
      label: "Edit recipe",
      onPress: openEdit,
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
          ref={moreButtonRef}
          onPress={toggleMenu}
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
        contentContainerStyle={{
          paddingBottom: tabBarClearance(insets, Spacing.five),
        }}
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
          {/* Title, description and times sit 16px apart (feedback 2026-07-16). */}
          <View className="w-full gap-layout-small">
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

          <View className="w-full gap-layout-small">
            {/* IMPROVISED, and marked as such: Thomas designed sections for the
                CREATE/EDIT screen (Figma 121:11255); no frame draws them here.
                This mirrors that screen exactly - heading outside the card, one
                card per section, 16px apart - because leaving the detail screen
                flat would show DOUGH as a tickable ingredient while you cook,
                which is the thing sections exist to stop. Worth a frame. */}
            {!recipe.ingredients.some((row) => row.isSection) && (
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
            )}
            {groupBySection(recipe.ingredients).map((group, groupIndex) => (
              <Fragment
                key={group.section ? group.section.row.id : `g${groupIndex}`}
              >
                {group.section != null && (
                  <View className="w-full flex-row items-center gap-comp-small">
                    <Text className="flex-1 font-header text-display-6 font-emphasized leading-xsmall text-text-default">
                      {group.section.row.name}
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
                )}
                {group.rows.length > 0 && (
            <View className="w-full overflow-hidden rounded-large">
              {group.rows.map(({ row: ingredient }, rowIndex) => (
                <Fragment key={ingredient.id}>
                  {/* Position WITHIN the card, not in the whole list - the
                      heading holds index 0, so the original index would draw a
                      divider above every section's first row. */}
                  {rowIndex > 0 && <RowDivider />}
                  <IngredientRow
                  ingredient={ingredient}
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
                    setUndoTarget({ kind: "ingredient", snapshot: ingredient });
                    await deleteIngredient(ingredient.id).catch((error) =>
                      console.warn("[recipes] delete ingredient failed", error),
                    );
                    reload();
                  }}
                  />
                </Fragment>
              ))}
            </View>
                )}
              </Fragment>
            ))}
            {recipe.ingredients.length === 0 && (
              <View className="w-full overflow-hidden rounded-large">
                <EmptyRowHint text="No ingredients yet – add the first one below." />
              </View>
            )}
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
                <Fragment key={step.id}>
                  {index > 0 && <RowDivider />}
                  <StepRow
                  step={step}
                  done={doneSteps.has(step.id)}
                  onToggle={() =>
                    setDoneSteps((current) => toggleInSet(current, step.id))
                  }
                  onEdit={() => setEditingStep(step)}
                  onDelete={async () => {
                    setUndoTarget({ kind: "step", snapshot: step });
                    await deleteStep(recipe.id, step.id).catch((error) =>
                      console.warn("[recipes] delete step failed", error),
                    );
                    reload();
                  }}
                  />
                </Fragment>
              ))}
              {recipe.steps.length === 0 && (
                <EmptyRowHint text="No instructions yet – add the first step below." />
              )}
            </View>
          </View>

          {/* Credit the page a URL-imported recipe came from. The importer has
              stored this since 2026-07-12; nothing read it back until now
              (Thomas, 2026-07-26 – placement and style his call: same quiet
              paragraph as the Plan tab's status line). Hand-typed recipes have
              no source and show nothing. */}
          {sourceUrl != null && (
            <Pressable
              // Opens the phone's browser rather than an in-app one: it is
              // somebody else's site, and leaving the app makes that plain
              // (Thomas, 2026-07-26).
              onPress={() =>
                Linking.openURL(sourceUrl).catch((error) =>
                  console.warn("[recipes] could not open source", error),
                )
              }
              accessibilityRole="link"
              accessibilityLabel={`Open the original recipe on ${sourceLabel(sourceUrl)}`}
              hitSlop={8}
            >
              <Text className="font-paragraph text-paragraph font-default text-text-subtle underline">
                {`From ${sourceLabel(sourceUrl)}`}
              </Text>
            </Pressable>
          )}

          {/* Edit the recipe's facts (name, photo, times, servings) –
              requested back after the menu item was removed (2026-07-12). */}
          <Pressable
            onPress={openEdit}
            accessibilityRole="button"
            className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium border-2 border-button-outline-border-enabled py-comp-large"
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
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={() => setMenuOpen(false)}
          accessibilityLabel="Close menu"
        />
      )}
      {menuOpen && (
        <View
          // Soft drop shadow (Thomas, 2026-07-25) – iOS reads shadow*, Android
          // needs elevation. NativeWind's shadow-lg alone renders flat here.
          style={{
            top: menuTop,
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
          className="absolute right-layout-small w-[260px] rounded-large bg-surface-neutral-white">
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
            : `Add this recipe's ingredients for ${chosenServings} ${chosenServings === 1 ? "serving" : "servings"} to the shopping list? You can also do this from your weekly plan.`
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

      <IngredientSheet
        visible={editingIngredient != null}
        editing={editingIngredient !== null && editingIngredient !== "new"}
        initialName={
          editingIngredient !== null && editingIngredient !== "new"
            ? editingIngredient.name
            : ""
        }
        initialQuantity={
          editingIngredient !== null && editingIngredient !== "new"
            ? (editingIngredient.quantityText ?? "")
            : ""
        }
        onClose={() => setEditingIngredient(null)}
        onSubmit={async (name, quantityText) => {
          const target = editingIngredient;
          setEditingIngredient(null);
          try {
            if (target !== null && target !== "new") {
              await updateIngredient(target.id, name, quantityText);
            } else {
              await addIngredient(
                recipe.id,
                name,
                quantityText,
                recipe.ingredients.length,
              );
            }
          } catch (error) {
            console.warn("[recipes] save ingredient failed", error);
          }
          reload();
        }}
      />

      <AddToPlanSheet
        visible={planSheetOpen}
        initialServings={chosenServings}
        onClose={() => setPlanSheetOpen(false)}
        onSubmit={(date, chosen) => {
          addRecipeToPlan(
            household.id,
            session?.user?.id ?? "",
            date,
            recipe.id,
            chosen,
          ).catch((error) =>
            console.warn("[recipes] add to plan failed", error),
          );
        }}
      />

      <StepSheet
        visible={editingStep != null}
        editing={editingStep !== null && editingStep !== "new"}
        initialText={
          editingStep !== null && editingStep !== "new" ? editingStep.text : ""
        }
        positionCount={recipe.steps.length + 1}
        initialPosition={
          editingStep !== null && editingStep !== "new"
            ? editingStep.stepNumber
            : recipe.steps.length + 1
        }
        onClose={() => setEditingStep(null)}
        onSubmit={async (text, position) => {
          const target = editingStep;
          setEditingStep(null);
          try {
            if (target !== null && target !== "new") {
              await updateStep(target.id, text);
            } else {
              await addStep(recipe.id, position, text);
            }
          } catch (error) {
            console.warn("[recipes] save step failed", error);
          }
          reload();
        }}
      />

      {/* Keyed on the deleted row so each delete remounts the toast – fresh
          entrance and a fresh 5s countdown. Sits above the tab bar. */}
      {undoTarget != null && (
        <UndoToast
          key={undoTarget.snapshot.id}
          name={
            undoTarget.kind === "ingredient"
              ? undoTarget.snapshot.name
              : `Step ${undoTarget.snapshot.stepNumber}`
          }
          onUndo={undoDelete}
          onDismiss={dismissUndo}
          bottomInset={tabBarClearance(insets, Spacing.three)}
        />
      )}
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

// A full-width hairline between rows, drawn directly in the card (outside
// the swipe wrapper) with an explicit style so neither the swipeable's
// layout nor NativeWind class compilation can inset or drop it.
export function RowDivider() {
  return <View className="h-px bg-border-subtle" />;
}

function IngredientRow({
  ingredient,
  quantityText,
  done,
  onToggle,
  onEdit,
  onDelete,
}: {
  ingredient: RecipeIngredient;
  quantityText: string | null;
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
          className="w-full flex-row items-center gap-comp-small bg-surface-neutral-white p-layout-small"
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
          <SwipeHint />
        </Pressable>
      </SwipeActions>
    </View>
  );
}

function StepRow({
  step,
  done,
  onToggle,
  onEdit,
  onDelete,
}: {
  step: RecipeStep;
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
          className="w-full flex-row items-start gap-comp-small bg-surface-neutral-white p-layout-small"
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
          <SwipeHint />
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
  return (
    <BottomSheet visible={visible} title={title} onClose={onCancel}>
      <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
        {body}
      </Text>
      {/* Cancel above the destructive action, per the Figma dialogs. */}
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        className="w-full items-center rounded-medium border-2 border-button-outline-border-enabled py-comp-large"
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
    </BottomSheet>
  );
}
