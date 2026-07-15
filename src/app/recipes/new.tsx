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
import { SafeAreaView } from "react-native-safe-area-context";

import { ServingsCounter } from "@/components/recipes/servings-counter";
import { ImportRecipeSheet } from "@/components/recipes/import-recipe-sheet";
import type { ImportedRecipe } from "@/lib/recipe-import";
import { ReorderSheet } from "@/components/recipes/reorder-sheet";
import { SwipeActions } from "@/components/recipes/swipe-actions";
import { Input } from "@/components/ui/input";
import { ds } from "@/constants/ds";
import { BottomTabInset } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/household-context";
import {
  createRecipe,
  fetchRecipe,
  replaceIngredientsAndSteps,
  updateRecipeFacts,
  uploadRecipePhoto,
} from "@/lib/recipes";

interface DraftIngredient {
  name: string;
  quantityText: string;
}

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
  const { id } = useLocalSearchParams<{ id?: string }>();
  const household = useHousehold();
  const { session } = useAuth();
  const router = useRouter();
  const editing = id != null && id.length > 0;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prep, setPrep] = useState("");
  const [cook, setCook] = useState("");
  const [servings, setServings] = useState(4);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [ingredientName, setIngredientName] = useState("");
  const [ingredientQuantity, setIngredientQuantity] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [stepText, setStepText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!editing);
  const [reordering, setReordering] = useState<"ingredients" | "steps" | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

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
        setIngredients(
          recipe.ingredients.map((ingredient) => ({
            name: ingredient.name,
            quantityText: ingredient.quantityText ?? "",
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
      })),
    );
    setSteps(imported.steps);
    setSourceUrl(imported.sourceUrl);
  };

  const stageIngredient = () => {
    const name = ingredientName.replace(/\s+/g, " ").trim();
    if (!name) return;
    setIngredients((current) => [
      ...current,
      { name, quantityText: ingredientQuantity.trim() },
    ]);
    setIngredientName("");
    setIngredientQuantity("");
  };

  const stageStep = () => {
    const text = stepText.trim();
    if (!text) return;
    setSteps((current) => [...current, text]);
    setStepText("");
  };

  // Swipe-edit on a staged row: its values return to the entry fields
  // (anything already typed there is staged first so nothing is lost).
  const editStagedIngredient = (index: number) => {
    const row = ingredients[index];
    setIngredients((current) => {
      const next = current.filter((_, i) => i !== index);
      const pending = ingredientName.replace(/\s+/g, " ").trim();
      if (pending)
        next.push({ name: pending, quantityText: ingredientQuantity.trim() });
      return next;
    });
    setIngredientName(row.name);
    setIngredientQuantity(row.quantityText);
  };

  const editStagedStep = (index: number) => {
    const row = steps[index];
    setSteps((current) => {
      const next = current.filter((_, i) => i !== index);
      if (stepText.trim()) next.push(stepText.trim());
      return next;
    });
    setStepText(row);
  };

  const save = async () => {
    const trimmedTitle = title.replace(/\s+/g, " ").trim();
    if (!trimmedTitle || busy) return;
    setBusy(true);
    try {
      let imageUrl = existingPhotoUrl;
      if (photoUri != null) {
        imageUrl = await uploadRecipePhoto(household.id, photoUri);
      }
      if (editing) {
        await updateRecipeFacts(id, {
          title: trimmedTitle,
          description: description.trim() || null,
          servings,
          prepMinutes: parseMinutes(prep),
          cookMinutes: parseMinutes(cook),
          imageUrl,
        });
        const draftIngredients = [...ingredients];
        const pendingName = ingredientName.replace(/\s+/g, " ").trim();
        if (pendingName)
          draftIngredients.push({
            name: pendingName,
            quantityText: ingredientQuantity.trim(),
          });
        const draftSteps = [...steps];
        if (stepText.trim()) draftSteps.push(stepText.trim());
        await replaceIngredientsAndSteps(
          id,
          draftIngredients.map((ingredient) => ({
            name: ingredient.name,
            quantityText: ingredient.quantityText || null,
          })),
          draftSteps,
        );
        router.back();
      } else {
        // Anything still sitting in the entry fields counts too – people
        // forget the final "Add" tap.
        const draftIngredients = [...ingredients];
        const lastName = ingredientName.replace(/\s+/g, " ").trim();
        if (lastName)
          draftIngredients.push({
            name: lastName,
            quantityText: ingredientQuantity.trim(),
          });
        const draftSteps = [...steps];
        if (stepText.trim()) draftSteps.push(stepText.trim());

        const recipeId = await createRecipe(
          household.id,
          session?.user?.id ?? "",
          {
            title: trimmedTitle,
            sourceUrl,
            description: description.trim() || null,
            servings,
            prepMinutes: parseMinutes(prep),
            cookMinutes: parseMinutes(cook),
            imageUrl,
            ingredients: draftIngredients.map((ingredient) => ({
              name: ingredient.name,
              quantityText: ingredient.quantityText || null,
            })),
            steps: draftSteps,
          },
        );
        router.replace(`/recipes/${recipeId}`);
      }
    } catch (error) {
      console.warn("[recipes] save failed", error);
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
        contentContainerStyle={{ paddingBottom: BottomTabInset + 24, gap: 16 }}
      >
        {/* Recipe facts card */}
        <View className="w-full px-layout-small">
          <View className="w-full gap-layout-small rounded-large bg-surface-neutral-white p-layout-small">
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
            <View className="w-full gap-layout-small rounded-large bg-surface-neutral-white p-layout-small">
              {ingredients.length > 0 && (
                <View style={{ marginHorizontal: -16 }}>
                  {ingredients.map((ingredient, index) => (
                    <Fragment key={`${ingredient.name}-${index}`}>
                      {index > 0 && (
                        <View
                          style={{ height: 1, backgroundColor: "#E7E6E4" }}
                        />
                      )}
                      <SwipeActions
                        label={ingredient.name}
                        onEdit={() => editStagedIngredient(index)}
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
                          {ingredient.quantityText.length > 0 && (
                            <Text className="font-paragraph text-paragraph font-default text-text-subtle">
                              {ingredient.quantityText}
                            </Text>
                          )}
                        </View>
                      </SwipeActions>
                    </Fragment>
                  ))}
                </View>
              )}
              <Field label="Ingredient">
                <Input
                  value={ingredientName}
                  onChangeText={setIngredientName}
                  placeholder="Cherry tomatoes"
                  accessibilityLabel="Ingredient name"
                />
              </Field>
              <Field label="Quantity">
                <Input
                  value={ingredientQuantity}
                  onChangeText={setIngredientQuantity}
                  placeholder="e.g. 250 g"
                  accessibilityLabel="Ingredient quantity"
                  onSubmitEditing={stageIngredient}
                  returnKeyType="done"
                />
              </Field>
              <OutlineButton
                icon="add"
                label="Add ingredient"
                onPress={stageIngredient}
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
            <View className="w-full gap-layout-small rounded-large bg-surface-neutral-white p-layout-small">
              {steps.length > 0 && (
                <View style={{ marginHorizontal: -16 }}>
                  {steps.map((step, index) => (
                    <Fragment key={`${index}-${step.slice(0, 12)}`}>
                      {index > 0 && (
                        <View
                          style={{ height: 1, backgroundColor: "#E7E6E4" }}
                        />
                      )}
                      <SwipeActions
                        label={`step ${index + 1}`}
                        onEdit={() => editStagedStep(index)}
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
                        </View>
                      </SwipeActions>
                    </Fragment>
                  ))}
                </View>
              )}
              <Field label="Instruction">
                <Input
                  value={stepText}
                  onChangeText={setStepText}
                  placeholder="Add your instruction here"
                  accessibilityLabel="Instruction"
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 96, textAlignVertical: "top" }}
                />
              </Field>
              <OutlineButton
                icon="add"
                label="Add instruction"
                onPress={stageStep}
              />
            </View>
          </View>
        </>
        <View className="w-full px-layout-small">
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
      </ScrollView>

      <ImportRecipeSheet
        visible={importing}
        onClose={() => setImporting(false)}
        onImported={applyImport}
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
      className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium border border-button-outline-border-enabled py-comp-large"
    >
      <MaterialIcons name={icon} size={20} color={ds.colors.icon.default} />
      <Text className="font-paragraph text-components-button-label font-default text-text-subtle">
        {label}
      </Text>
    </Pressable>
  );
}
