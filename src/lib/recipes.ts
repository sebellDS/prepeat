// Recipes data access (migration 0006). Plain async functions – recipe
// editing is deliberately NOT realtime (projektgrundlag: the classic
// conflict problem; last write wins), so screens fetch on focus instead of
// subscribing. Favorites are shared household favorites (decided
// 2026-07-12): a flag on the recipe row, one heart for the whole family.
import * as Crypto from "expo-crypto";

import {
  normalizeItemName,
  getOrCreateListId,
  CATEGORIES,
  type Category,
} from "@/lib/shopping-list";
import { parseQuantity, formatQuantity, roundQuantity } from "@/lib/quantity";
import { supabase } from "@/lib/supabase";
import { weekStartOf } from "@/lib/week";

export interface RecipeSummary {
  id: string;
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  isFavorite: boolean;
  /** The recipe's own default serving count – the add-to-plan counter
   * starts here rather than at the last-used value. */
  servings: number;
  /** Ingredient names, so search can match "chicken" without tags. */
  ingredientNames: string[];
}

export interface RecipeIngredient {
  id: string;
  name: string;
  /** Display string assembled from numeric quantity + unit ("250 g"). */
  quantityText: string | null;
  quantity: number | null;
  unit: string | null;
  sortOrder: number;
}

export interface RecipeStep {
  id: string;
  stepNumber: number;
  text: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  imageUrl: string | null;
  isFavorite: boolean;
  createdByUserId: string;
  /**
   * The page a URL-imported recipe was read from. Saved since 2026-07-12 but
   * only surfaced on the detail screen from 2026-07-26 – null for anything
   * typed by hand.
   */
  sourceUrl: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

/**
 * "valdemarsro.dk" from a full URL – what the recipe detail credits. Falls
 * back to the raw string if it will not parse, so a stored oddity still shows
 * something rather than crashing the screen.
 */
export function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function totalMinutes(
  prep: number | null,
  cook: number | null,
): number | null {
  if (prep == null && cook == null) return null;
  return (prep ?? 0) + (cook ?? 0);
}

/** Scales an ingredient for a chosen serving count and formats for display. */
export function scaledQuantityText(
  ingredient: Pick<RecipeIngredient, "quantity" | "unit">,
  recipeServings: number,
  chosenServings: number,
): string | null {
  if (ingredient.quantity == null) return ingredient.unit;
  const factor = recipeServings > 0 ? chosenServings / recipeServings : 1;
  return formatQuantity(
    roundQuantity(ingredient.quantity * factor),
    ingredient.unit,
  );
}

export async function fetchRecipes(
  householdId: string,
): Promise<RecipeSummary[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, title, image_url, servings, prep_minutes, cook_minutes, is_favorite, recipe_ingredients(name)",
    )
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    totalMinutes: totalMinutes(row.prep_minutes, row.cook_minutes),
    isFavorite: row.is_favorite,
    servings: row.servings ?? 4,
    ingredientNames: (row.recipe_ingredients ?? []).map(
      (i: { name: string }) => i.name,
    ),
  }));
}

/** One search box matches titles AND ingredients (decided 2026-07-12). */
export function matchesSearch(recipe: RecipeSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (recipe.title.toLowerCase().includes(needle)) return true;
  return recipe.ingredientNames.some((name) =>
    name.toLowerCase().includes(needle),
  );
}

export async function fetchRecipe(id: string): Promise<Recipe> {
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, title, description, servings, prep_minutes, cook_minutes, image_url, is_favorite, created_by_user_id, source_url, recipe_ingredients(id, name, quantity, unit, sort_order), recipe_steps(id, step_number, text)",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  const ingredients = (data.recipe_ingredients ?? [])
    .map(
      (row: {
        id: string;
        name: string;
        quantity: number | string | null;
        unit: string | null;
        sort_order: number;
      }) => ({
        id: row.id,
        name: row.name,
        quantity: row.quantity == null ? null : Number(row.quantity),
        unit: row.unit,
        quantityText: formatQuantity(
          row.quantity == null ? null : Number(row.quantity),
          row.unit,
        ),
        sortOrder: row.sort_order,
      }),
    )
    .sort(
      (a: RecipeIngredient, b: RecipeIngredient) => a.sortOrder - b.sortOrder,
    );
  const steps = (data.recipe_steps ?? [])
    .map((row: { id: string; step_number: number; text: string }) => ({
      id: row.id,
      stepNumber: row.step_number,
      text: row.text,
    }))
    .sort((a: RecipeStep, b: RecipeStep) => a.stepNumber - b.stepNumber);
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    servings: data.servings,
    prepMinutes: data.prep_minutes,
    cookMinutes: data.cook_minutes,
    imageUrl: data.image_url,
    isFavorite: data.is_favorite,
    createdByUserId: data.created_by_user_id,
    sourceUrl: data.source_url,
    ingredients,
    steps,
  };
}

export interface RecipeDraft {
  title: string;
  /** Where the recipe was imported from, if it came from a link. */
  sourceUrl?: string | null;
  description: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  imageUrl: string | null;
  /** Free-text quantities, parsed at the database boundary. */
  ingredients: { name: string; quantityText: string | null }[];
  steps: string[];
}

export async function createRecipe(
  householdId: string,
  userId: string,
  draft: RecipeDraft,
): Promise<string> {
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      household_id: householdId,
      created_by_user_id: userId,
      title: draft.title.replace(/\s+/g, " ").trim(),
      description: draft.description,
      servings: draft.servings,
      prep_minutes: draft.prepMinutes,
      cook_minutes: draft.cookMinutes,
      image_url: draft.imageUrl,
      source_url: draft.sourceUrl ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const recipeId = data.id as string;

  if (draft.ingredients.length > 0) {
    const rows = draft.ingredients.map((ingredient, index) => {
      const { quantity, unit } = parseQuantity(ingredient.quantityText);
      return {
        recipe_id: recipeId,
        name: ingredient.name.trim(),
        quantity,
        unit,
        sort_order: index,
      };
    });
    const { error: ingredientsError } = await supabase
      .from("recipe_ingredients")
      .insert(rows);
    if (ingredientsError) throw ingredientsError;
  }
  if (draft.steps.length > 0) {
    const rows = draft.steps.map((text, index) => ({
      recipe_id: recipeId,
      step_number: index + 1,
      text: text.trim(),
    }));
    const { error: stepsError } = await supabase
      .from("recipe_steps")
      .insert(rows);
    if (stepsError) throw stepsError;
  }
  return recipeId;
}

export async function updateRecipeFacts(
  id: string,
  fields: Partial<
    Pick<
      RecipeDraft,
      | "title"
      | "description"
      | "servings"
      | "prepMinutes"
      | "cookMinutes"
      | "imageUrl"
      | "sourceUrl"
    >
  >,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (fields.title !== undefined)
    patch.title = fields.title.replace(/\s+/g, " ").trim();
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.servings !== undefined) patch.servings = fields.servings;
  if (fields.prepMinutes !== undefined) patch.prep_minutes = fields.prepMinutes;
  if (fields.cookMinutes !== undefined) patch.cook_minutes = fields.cookMinutes;
  if (fields.imageUrl !== undefined) patch.image_url = fields.imageUrl;
  // Editable since 2026-07-27 – including clearing it, so an explicit null is
  // meaningful here and must not be treated as "leave alone".
  if (fields.sourceUrl !== undefined) patch.source_url = fields.sourceUrl;
  const { error } = await supabase.from("recipes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setFavorite(
  id: string,
  isFavorite: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("recipes")
    .update({ is_favorite: isFavorite })
    .eq("id", id);
  if (error) throw error;
}

export async function softDeleteRecipe(id: string): Promise<void> {
  const { error } = await supabase
    .from("recipes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Replaces a recipe's ingredients and steps wholesale – the edit form
 * treats them as one editable document. Safe because nothing references
 * the child rows by id (the shopping list works on snapshots).
 */
export async function replaceIngredientsAndSteps(
  recipeId: string,
  ingredients: { name: string; quantityText: string | null }[],
  steps: string[],
): Promise<void> {
  const { error: clearIngredientsError } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId);
  if (clearIngredientsError) throw clearIngredientsError;
  const { error: clearStepsError } = await supabase
    .from("recipe_steps")
    .delete()
    .eq("recipe_id", recipeId);
  if (clearStepsError) throw clearStepsError;

  if (ingredients.length > 0) {
    const rows = ingredients.map((ingredient, index) => {
      const { quantity, unit } = parseQuantity(ingredient.quantityText);
      return {
        recipe_id: recipeId,
        name: ingredient.name.trim(),
        quantity,
        unit,
        sort_order: index,
      };
    });
    const { error } = await supabase.from("recipe_ingredients").insert(rows);
    if (error) throw error;
  }
  if (steps.length > 0) {
    const rows = steps.map((text, index) => ({
      recipe_id: recipeId,
      step_number: index + 1,
      text: text.trim(),
    }));
    const { error } = await supabase.from("recipe_steps").insert(rows);
    if (error) throw error;
  }
}

// ── Ingredients ──────────────────────────────────────────────────────────

export async function addIngredient(
  recipeId: string,
  name: string,
  quantityText: string | null,
  sortOrder: number,
): Promise<void> {
  const { quantity, unit } = parseQuantity(quantityText);
  const { error } = await supabase.from("recipe_ingredients").insert({
    recipe_id: recipeId,
    name: name.trim(),
    quantity,
    unit,
    sort_order: sortOrder,
  });
  if (error) throw error;
}

export async function updateIngredient(
  id: string,
  name: string,
  quantityText: string | null,
): Promise<void> {
  const { quantity, unit } = parseQuantity(quantityText);
  const { error } = await supabase
    .from("recipe_ingredients")
    .update({ name: name.trim(), quantity, unit })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Persists a drag-reorder of ingredients (sort_order follows the array).
 * One atomic RPC (migration 0020) renumbers every row in a single write, so
 * an interrupted reorder can't leave the list half-saved – the old per-row
 * loop could.
 */
export async function reorderIngredients(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const { error } = await supabase.rpc("reorder_recipe_ingredients", {
    p_ids: orderedIds,
  });
  if (error) throw error;
}

/** Persists a drag-reorder of steps (step_number follows the array). */
export async function reorderSteps(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const { error } = await supabase.rpc("reorder_recipe_steps", {
    p_ids: orderedIds,
  });
  if (error) throw error;
}

// ── Steps ────────────────────────────────────────────────────────────────
// The design's step-number picker lets a step land at any position; numbers
// are renumbered densely (1..n) around it.

export async function addStep(
  recipeId: string,
  position: number,
  text: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("recipe_steps")
    .select("id, step_number")
    .eq("recipe_id", recipeId)
    .order("step_number");
  if (error) throw error;
  const steps = data ?? [];
  const clamped = Math.max(1, Math.min(position, steps.length + 1));
  // Shift everything at/after the chosen slot down by one.
  for (const step of steps.filter((s) => s.step_number >= clamped).reverse()) {
    const { error: shiftError } = await supabase
      .from("recipe_steps")
      .update({ step_number: step.step_number + 1 })
      .eq("id", step.id);
    if (shiftError) throw shiftError;
  }
  const { error: insertError } = await supabase
    .from("recipe_steps")
    .insert({ recipe_id: recipeId, step_number: clamped, text: text.trim() });
  if (insertError) throw insertError;
}

export async function updateStep(id: string, text: string): Promise<void> {
  const { error } = await supabase
    .from("recipe_steps")
    .update({ text: text.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteStep(recipeId: string, id: string): Promise<void> {
  const { error } = await supabase.from("recipe_steps").delete().eq("id", id);
  if (error) throw error;
  // Close the gap so numbering stays dense.
  const { data, error: fetchError } = await supabase
    .from("recipe_steps")
    .select("id, step_number")
    .eq("recipe_id", recipeId)
    .order("step_number");
  if (fetchError) throw fetchError;
  for (const [index, step] of (data ?? []).entries()) {
    if (step.step_number !== index + 1) {
      const { error: renumberError } = await supabase
        .from("recipe_steps")
        .update({ step_number: index + 1 })
        .eq("id", step.id);
      if (renumberError) throw renumberError;
    }
  }
}

// ── Shopping list hand-off ───────────────────────────────────────────────

/**
 * Writes the recipe's ingredients (scaled to the chosen servings) into the
 * household's active shopping list. Learned categories apply, same as
 * typing the item by hand; the realtime channel delivers the new rows to
 * every open shopping screen.
 */
export async function addIngredientsToShoppingList(
  recipe: Recipe,
  chosenServings: number,
  householdId: string,
  userId: string,
): Promise<number> {
  if (recipe.ingredients.length === 0) return 0;
  // Weekly lists (0008): ingredients from a recipe go on this week's list.
  const listId = await getOrCreateListId(
    householdId,
    userId,
    weekStartOf(new Date()),
  );
  const { data: memoryRows, error: memoryError } = await supabase
    .from("item_category_memory")
    .select("name, aisle")
    .eq("household_id", householdId);
  if (memoryError) throw memoryError;
  const memory = new Map<string, string>();
  for (const row of memoryRows ?? []) {
    if ((CATEGORIES as readonly string[]).includes(row.aisle))
      memory.set(row.name, row.aisle);
  }
  const factor = recipe.servings > 0 ? chosenServings / recipe.servings : 1;
  const rows = recipe.ingredients.map((ingredient) => ({
    id: Crypto.randomUUID(),
    list_id: listId,
    name: ingredient.name,
    quantity:
      ingredient.quantity == null
        ? null
        : roundQuantity(ingredient.quantity * factor),
    unit: ingredient.unit,
    aisle: (memory.get(normalizeItemName(ingredient.name)) ??
      null) as Category | null,
    // User-owned, not plan-generated: the plan reconciler must shrink these
    // rather than delete them when a later meal's share is withdrawn (#5).
    added_manually: true,
    created_by_user_id: userId,
  }));
  const { error } = await supabase.from("shopping_list_items").insert(rows);
  if (error) throw error;
  return rows.length;
}

// ── Photos ───────────────────────────────────────────────────────────────

/** Uploads a local photo and returns its public URL. */
export async function uploadRecipePhoto(
  householdId: string,
  localUri: string,
): Promise<string> {
  const response = await fetch(localUri);
  const body = await response.arrayBuffer();
  const path = `${householdId}/${Crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("recipe-photos")
    .upload(path, body, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from("recipe-photos").getPublicUrl(path).data
    .publicUrl;
}
