import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Fragment, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ServingsCounter } from "@/components/recipes/servings-counter";
import { ImportRecipeSheet } from "@/components/recipes/import-recipe-sheet";
import { IngredientSheet } from "@/components/recipes/ingredient-sheet";
import { StepSheet } from "@/components/recipes/step-sheet";
import type { ImportedRecipe } from "@/lib/recipe-import";
import { ReorderSheet } from "@/components/ui/reorder-sheet";
import { SwipeActions } from "@/components/recipes/swipe-actions";
import { SwipeHint } from "@/components/ui/swipe-hint";
import { Input } from "@/components/ui/input";
import { ds } from "@/constants/ds";
import { Spacing, tabBarClearance } from "@/constants/theme";
import { friendlyError } from "@/lib/error-messages";
import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/household-context";
import {
  createRecipe,
  fetchRecipe,
  replaceIngredientsAndSteps,
  updateRecipeFacts,
  uploadRecipePhoto,
} from "@/lib/recipes";
import type { DraftIngredient } from "@/lib/recipes";

/** Leading number in "10 min" style time fields; empty/absent → null. */
function parseMinutes(text: string): number | null {
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * "Add new recipe" (Figma section 121:11255): recipe facts, servings,
 * photo, then ingredients and instructions built up inline. With ?id= the
 * same form reopens filled to edit an existing recipe's facts.
 */
export default function AddRecipeScreen() {
  // ?title= prefills the name – the plan's recipe picker sends its search
  // term here when the meal is not in the library yet (2026-07-16).
  const { id, title: titleParam } = useLocalSearchParams<{
    id?: string;
    title?: string;
  }>();
  const household = useHousehold();
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const editing = id != null && id.length > 0;

  const [title, setTitle] = useState(editing ? "" : (titleParam ?? ""));
  const [description, setDescription] = useState("");
  const [prep, setPrep] = useState("");
  const [cook, setCook] = useState("");
  const [servings, setServings] = useState(4);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editing);
  const [reordering, setReordering] = useState<"ingredients" | "steps" | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  // Add and edit both go through the focused sheet: "add" opens it empty,
  // { index } opens it on an existing draft row (Pia's feedback, 2026-07-15).
  const [ingredientSheet, setIngredientSheet] = useState<
    { index: number } | "add" | null
  >(null);
  const [stepSheet, setStepSheet] = useState<{ index: number } | "add" | null>(
    null,
  );
  // Held as a plain string so the field can be typed in and cleared; saved as
  // null when empty. Filled by an import, and editable ever since (2026-07-27).
  const [sourceUrl, setSourceUrl] = useState("");

  useEffect(() => {
    if (!editing) return;
    fetchRecipe(id)
      .then((recipe) => {
        setTitle(recipe.title);
        setDescription(recipe.description ?? "");
        setPrep(recipe.prepMinutes != null ? String(recipe.prepMinutes) : "");
        setCook(recipe.cookMinutes != null ? String(recipe.cookMinutes) : "");
        setServings(recipe.servings);
        setExistingPhotoUrl(recipe.imageUrl);
        setSourceUrl(recipe.sourceUrl ?? "");
        setIngredients(
          recipe.ingredients.map((ingredient) => ({
            name: ingredient.name,
            quantityText: ingredient.quantityText ?? "",
            isSection: ingredient.isSection,
          })),
        );
        setSteps(recipe.steps.map((step) => step.text));
        setLoaded(true);
      })
      .catch((error) => console.warn("[recipes] edit fetch failed", error));
  }, [editing, id]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // Everything found on the page lands in the form for review – the
  // external photo URL goes through the normal upload on save.
  const applyImport = (imported: ImportedRecipe) => {
    setImporting(false);
    setTitle(imported.title);
    setDescription(imported.description ?? "");
    setPrep(imported.prepMinutes != null ? String(imported.prepMinutes) : "");
    setCook(imported.cookMinutes != null ? String(imported.cookMinutes) : "");
    if (imported.servings != null) setServings(imported.servings);
    if (imported.imageUrl != null) setPhotoUri(imported.imageUrl);
    setIngredients(
      imported.ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantityText: ingredient.quantityText ?? "",
        isSection: ingredient.isSection === true,
      })),
    );
    setSteps(imported.steps);
    setSourceUrl(imported.sourceUrl);
  };

  // Ingredients and instructions are added and edited entirely through the
  // focused sheets (Pia's feedback, 2026-07-15).

  const save = async () => {
    const trimmedTitle = title.replace(/\s+/g, " ").trim();
    if (!trimmedTitle || busy) return;
    // An emptied field means "no source", not an empty string.
    const trimmedSource = sourceUrl.trim() || null;
    setBusy(true);
    setSaveError(null);
    try {
      let imageUrl = existingPhotoUrl;
      if (photoUri != null) {
        // The photo must never cost you the recipe. On import photoUri is an
        // external URL taken straight off the page (applyImport), so this
        // upload is the most likely thing to fail here – a hotlink-blocked or
        // moved image, a relative path, a flaky connection. Losing the whole
        // reviewed recipe to that is the worst outcome; saving it without the
        // picture is recoverable (add one later from Edit). Audit 2026-08-02.
        try {
          imageUrl = await uploadRecipePhoto(household.id, photoUri);
        } catch (photoError) {
          console.warn("[recipes] photo upload failed, saving without it", photoError);
          imageUrl = existingPhotoUrl;
        }
      }
      if (editing) {
        await updateRecipeFacts(id, {
          title: trimmedTitle,
          description: description.trim() || null,
          servings,
          prepMinutes: parseMinutes(prep),
          cookMinutes: parseMinutes(cook),
          imageUrl,
          sourceUrl: trimmedSource,
        });
        await replaceIngredientsAndSteps(
          id,
          ingredients.map((ingredient) => ({
            name: ingredient.name,
            quantityText: ingredient.quantityText || null,
          })),
          steps,
        );
        router.back();
      } else {
        const recipeId = await createRecipe(
          household.id,
          session?.user?.id ?? "",
          {
            title: trimmedTitle,
            sourceUrl: trimmedSource,
            description: description.trim() || null,
            servings,
            prepMinutes: parseMinutes(prep),
            cookMinutes: parseMinutes(cook),
            imageUrl,
            ingredients: ingredients.map((ingredient) => ({
              name: ingredient.name,
              quantityText: ingredient.quantityText || null,
            })),
            steps,
          },
        );
        router.replace(`/recipes/${recipeId}`);
      }
    } catch (error) {
      // Never fail silently: the form keeps everything the user typed (or
      // imported and reviewed) so Save can simply be pressed again.
      console.warn("[recipes] save failed", error);
      setSaveError(friendlyError(error));
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <SafeAreaView
        edges={["top"]}
        className="flex-1 items-center justify-center bg-surface-neutral-lightest"
      >
        <ActivityIndicator color={ds.colors.surface.primary.main} />
      </SafeAreaView>
    );
  }

  const photoPreview = photoUri ?? existingPhotoUrl;

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 bg-surface-neutral-lightest"
    >
      <View className="w-full flex-row items-center px-layout-small py-comp-small">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MaterialIcons
            name="arrow-back"
            size={28}
            color={ds.colors.surface.primary.main}
          />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          // The save bar below is a real footer, so the scroll area only needs
          // a little breathing room at the end – not the tab-bar clearance.
          paddingBottom: Spacing.three,
          gap: 16,
        }}
      >
        {/* Recipe facts card */}
        <View className="w-full px-layout-small">
          <View className="w-full gap-layout-small overflow-hidden rounded-large bg-surface-neutral-white p-layout-small">
            <MaterialIcons
              name="receipt-long"
              size={40}
              color={ds.colors.surface.primary.main}
            />
            <View className="w-full gap-comp-small">
              <Text className="font-header text-display-5 font-emphasized leading-small text-text-default">
                {editing ? "Edit recipe" : "Add new recipe"}
              </Text>
              <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
                Save the dishes your family loves – one shared cookbook for
                everyone.
              </Text>
            </View>

            {!editing && (
              <OutlineButton
                icon="link"
                label="Add from a link"
                onPress={() => setImporting(true)}
              />
            )}

            {/* Image sits at the top of the inputs (feedback 2026-07-16). */}
            {photoPreview != null && (
              <View className="h-[160px] w-full overflow-hidden rounded-medium">
                <Image
                  source={{ uri: photoPreview }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              </View>
            )}
            <OutlineButton
              icon="add-photo-alternate"
              label={photoPreview != null ? "Change the image" : "Add an image"}
              onPress={pickPhoto}
            />

            <Field label="Recipe name">
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="Pasta al Pomodoro"
                accessibilityLabel="Recipe name"
              />
            </Field>
            <Field label="Description">
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="A quick weeknight classic"
                accessibilityLabel="Description"
                multiline
                // A recipe blurb runs to a few lines – grow the field into a
                // text area that starts top-aligned rather than a one-line input.
                textAlignVertical="top"
                style={{ minHeight: 96 }}
              />
            </Field>
            <Field label="Preparation time">
              <Input
                value={prep}
                onChangeText={setPrep}
                placeholder="10 min"
                accessibilityLabel="Preparation time"
              />
            </Field>
            <Field label="Cooking time">
              <Input
                value={cook}
                onChangeText={setCook}
                placeholder="20 min"
                accessibilityLabel="Cooking time"
              />
            </Field>
            <Field label="Servings">
              <ServingsCounter value={servings} onChange={setServings} />
            </Field>
            {/* Filled automatically by a link import; editable so a recipe you
                have made your own can drop or correct the credit (Thomas,
                2026-07-27). Last of the facts, mirroring where it shows on the
                detail screen. IMPROVISED – no Figma frame for this field. */}
            <Field label="Source">
              <Input
                value={sourceUrl}
                onChangeText={setSourceUrl}
                placeholder="https://example.com/recipe"
                accessibilityLabel="Source link"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
          </View>
        </View>

        <>
          {/* Ingredients builder */}
          <View className="w-full gap-comp-xsmall px-layout-small">
            <View className="w-full flex-row items-center">
              <Text className="flex-1 font-paragraph text-paragraph font-emphasized text-text-default">
                Ingredients
              </Text>
              {ingredients.length > 1 && (
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
            <View className="w-full gap-layout-small overflow-hidden rounded-large bg-surface-neutral-white p-layout-small">
              {ingredients.length > 0 && (
                <View style={{ marginHorizontal: -16, marginTop: -16 }}>
                  {ingredients.map((ingredient, index) => (
                    <Fragment key={`${ingredient.name}-${index}`}>
                      {index > 0 && (
                        <View
                          className="h-px bg-border-subtle"
                        />
                      )}
                      <SwipeActions
                        label={ingredient.name}
                        onEdit={() => setIngredientSheet({ index })}
                        onDelete={() =>
                          setIngredients((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <View className="h-[56px] w-full flex-row items-center gap-layout-small bg-surface-neutral-white px-layout-small">
                          <Text className="flex-1 font-paragraph text-paragraph font-default text-text-default">
                            {ingredient.name}
                          </Text>
                          {(ingredient.quantityText?.length ?? 0) > 0 && (
                            <Text className="font-paragraph text-paragraph font-default text-text-subtle">
                              {ingredient.quantityText}
                            </Text>
                          )}
                          <SwipeHint />
                        </View>
                      </SwipeActions>
                    </Fragment>
                  ))}
                  {/* Close off the list with a line before the add button. */}
                  <View className="h-px bg-border-subtle" />
                </View>
              )}
              <OutlineButton
                icon="add"
                label="Add ingredient"
                onPress={() => setIngredientSheet("add")}
              />
            </View>
          </View>

          {/* Instructions builder */}
          <View className="w-full gap-comp-xsmall px-layout-small">
            <View className="w-full flex-row items-center">
              <Text className="flex-1 font-paragraph text-paragraph font-emphasized text-text-default">
                Instructions
              </Text>
              {steps.length > 1 && (
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
            <View className="w-full gap-layout-small overflow-hidden rounded-large bg-surface-neutral-white p-layout-small">
              {steps.length > 0 && (
                <View style={{ marginHorizontal: -16, marginTop: -16 }}>
                  {steps.map((step, index) => (
                    <Fragment key={`${index}-${step.slice(0, 12)}`}>
                      {index > 0 && (
                        <View
                          className="h-px bg-border-subtle"
                        />
                      )}
                      <SwipeActions
                        label={`step ${index + 1}`}
                        onEdit={() => setStepSheet({ index })}
                        onDelete={() =>
                          setSteps((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <View className="w-full flex-row items-start gap-layout-small bg-surface-neutral-white px-layout-small py-layout-small">
                          <View className="min-w-[32px] items-center justify-center rounded-xlarge bg-surface-neutral-main px-comp-medium py-comp-small">
                            <Text className="font-paragraph text-small font-emphasized leading-xxsmall text-text-default">
                              {index + 1}
                            </Text>
                          </View>
                          <Text
                            style={{ paddingTop: 4 }}
                            className="min-w-0 flex-1 font-paragraph text-paragraph font-default leading-xsmall text-text-default"
                          >
                            {step}
                          </Text>
                          <SwipeHint />
                        </View>
                      </SwipeActions>
                    </Fragment>
                  ))}
                  {/* Close off the list with a line before the add button. */}
                  <View className="h-px bg-border-subtle" />
                </View>
              )}
              <OutlineButton
                icon="add"
                label="Add instruction"
                onPress={() => setStepSheet("add")}
              />
            </View>
          </View>
        </>
      </ScrollView>

      {/* Save is pinned to the bottom of the screen rather than scrolling
          away at the end of the form: on a long recipe it sat far below the
          fold and edits were being lost by leaving without it (Thomas,
          2026-07-28). IMPROVISED – the Figma add/edit frame puts the button
          at the end of the page and has no sticky-footer frame yet. */}
      <View
        style={{ paddingBottom: tabBarClearance(insets, Spacing.three) }}
        className="w-full gap-comp-small border-t border-border-subtle bg-surface-neutral-lightest px-layout-small pt-comp-medium"
      >
        {/* Sits in the pinned footer, beside the button that failed, so it
            cannot scroll out of view on a long recipe. Same banner as the
            onboarding/household modals. */}
        {saveError != null && (
          <View className="w-full flex-row items-start gap-comp-large rounded-medium bg-error-lightest px-comp-large py-comp-small">
            <Text className="flex-1 font-paragraph text-paragraph font-default leading-xsmall text-text-default">
              {saveError}
            </Text>
            <MaterialIcons name="error-outline" size={24} color={ds.colors.icon.default} />
          </View>
        )}
        <Pressable
          onPress={save}
          disabled={busy || title.trim().length === 0}
          accessibilityRole="button"
          className={
            "w-full items-center rounded-medium py-comp-large " +
            (busy || title.trim().length === 0
              ? "bg-surface-neutral-main"
              : "bg-button-solid-fill-enabled")
          }
        >
          {busy ? (
            <ActivityIndicator color={ds.colors.text.inverse} />
          ) : (
            <Text className="font-paragraph text-components-button-label font-default text-button-solid-label-enabled">
              {editing ? "Save changes" : "Save recipe"}
            </Text>
          )}
        </Pressable>
      </View>

      <ImportRecipeSheet
        visible={importing}
        onClose={() => setImporting(false)}
        onImported={applyImport}
      />

      <IngredientSheet
        visible={ingredientSheet != null}
        editing={ingredientSheet !== null && ingredientSheet !== "add"}
        initialName={
          ingredientSheet !== null && ingredientSheet !== "add"
            ? (ingredients[ingredientSheet.index]?.name ?? "")
            : ""
        }
        initialQuantity={
          ingredientSheet !== null && ingredientSheet !== "add"
            ? (ingredients[ingredientSheet.index]?.quantityText ?? "")
            : ""
        }
        onClose={() => setIngredientSheet(null)}
        onSubmit={(name, quantityText) => {
          const target = ingredientSheet;
          setIngredientSheet(null);
          if (target === "add") {
            setIngredients((current) => [
              ...current,
              { name, quantityText: quantityText ?? "" },
            ]);
          } else if (target != null) {
            setIngredients((current) =>
              current.map((existing, i) =>
                i === target.index
                  ? {
                      name,
                      quantityText: quantityText ?? "",
                      // Renaming a heading keeps it a heading.
                      isSection: existing.isSection,
                    }
                  : existing,
              ),
            );
          }
        }}
      />

      <StepSheet
        visible={stepSheet != null}
        editing={stepSheet !== null && stepSheet !== "add"}
        initialText={
          stepSheet !== null && stepSheet !== "add"
            ? (steps[stepSheet.index] ?? "")
            : ""
        }
        positionCount={
          stepSheet === "add" ? steps.length + 1 : steps.length
        }
        initialPosition={
          stepSheet !== null && stepSheet !== "add"
            ? stepSheet.index + 1
            : steps.length + 1
        }
        onClose={() => setStepSheet(null)}
        onSubmit={(text, position) => {
          const target = stepSheet;
          setStepSheet(null);
          if (target === "add") {
            // Insert at the chosen position (1-based).
            setSteps((current) => [
              ...current.slice(0, position - 1),
              text,
              ...current.slice(position - 1),
            ]);
          } else if (target != null) {
            setSteps((current) =>
              current.map((existing, i) => (i === target.index ? text : existing)),
            );
          }
        }}
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
            ? steps.map((step, index) => ({
                key: String(index),
                label: `${index + 1}. ${step}`,
              }))
            : ingredients.map((ingredient, index) => ({
                key: String(index),
                label: ingredient.name,
              }))
        }
        onClose={() => setReordering(null)}
        onChange={(orderedKeys) => {
          if (reordering === "steps") {
            setSteps((current) =>
              orderedKeys.map((key) => current[Number(key)]),
            );
          } else {
            setIngredients((current) =>
              orderedKeys.map((key) => current[Number(key)]),
            );
          }
        }}
      />
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="w-full gap-comp-xsmall">
      <Text className="font-paragraph text-small font-default text-text-subtle">
        {label}
      </Text>
      {children}
    </View>
  );
}

function OutlineButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium border-2 border-button-outline-border-enabled py-comp-large"
    >
      <MaterialIcons name={icon} size={20} color={ds.colors.icon.default} />
      <Text className="font-paragraph text-components-button-label font-default text-text-subtle">
        {label}
      </Text>
    </Pressable>
  );
}
