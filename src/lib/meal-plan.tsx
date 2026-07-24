// The household's weekly meal plan, backed by Supabase (meal_plans,
// meal_plan_entries, meal_plan_entry_ingredients – migration 0007).
//
// Same sync model as the shopping list: actions apply to local state
// immediately, writes go to Supabase in the background (last write wins via
// updated_at), and realtime channels stream the other phones' changes in.
// Ingredients are snapshotted onto entries at add time and scaled as
// servings / recipe_servings – the plan never reads ingredients live from
// recipes (projektgrundlag core principle).
//
// Week navigation (2026-07-16, revised 2026-07-17): the switcher moves
// between existing weeks (plus the current week, which always shows), two
// weeks back at most – and "›" past the last week silently creates a clean
// next week (the header "+" and the copy-week option retired).
import * as Crypto from "expo-crypto";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/household-context";
import {
  contributeEntry,
  pushPlanToList,
  rescaleEntry,
  withdrawEntry,
} from "@/lib/plan-shopping";
import { fetchRecipe, type Recipe } from "@/lib/recipes";
import { type LiveStatus } from "@/lib/shopping-list";
import { supabase } from "@/lib/supabase";
import { addWeeksKey, fromDateKey, weekStartOf } from "@/lib/week";

/** How far back the week switcher reaches (decided 2026-07-16). */
export const WEEKS_BACK_LIMIT = 2;

export interface PlanWeek {
  id: string;
  weekStart: string; // 'YYYY-MM-DD', always a Monday
  pushedToListAt: number | null;
  updatedAt: number;
}

export interface PlanEntry {
  id: string;
  planId: string;
  date: string; // 'YYYY-MM-DD'
  /** Null for manual meals ("Leftovers") – migration 0009. */
  recipeId: string | null;
  recipeTitle: string;
  recipeImageUrl: string | null;
  servings: number;
  recipeServings: number;
  createdAt: number;
  updatedAt: number;
}

interface PlanRow {
  id: string;
  week_start_date: string;
  pushed_to_list_at: string | null;
  updated_at: string;
  deleted_at: string | null;
}

interface EntryRow {
  id: string;
  meal_plan_id: string;
  date: string;
  recipe_id: string | null;
  title: string | null;
  servings: number;
  recipe_servings: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  recipes?: { title: string; image_url: string | null } | null;
}

function rowToWeek(row: PlanRow): PlanWeek {
  return {
    id: row.id,
    weekStart: row.week_start_date,
    pushedToListAt: row.pushed_to_list_at
      ? Date.parse(row.pushed_to_list_at)
      : null,
    updatedAt: Date.parse(row.updated_at),
  };
}

function rowToEntry(row: EntryRow, prev?: PlanEntry): PlanEntry {
  return {
    id: row.id,
    planId: row.meal_plan_id,
    date: row.date,
    recipeId: row.recipe_id,
    recipeTitle: row.title ?? row.recipes?.title ?? prev?.recipeTitle ?? "",
    recipeImageUrl: row.recipes?.image_url ?? prev?.recipeImageUrl ?? null,
    servings: row.servings,
    recipeServings: row.recipe_servings,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}

interface State {
  weeks: PlanWeek[];
  /** Entries of the viewed week only. */
  entries: PlanEntry[];
  viewedWeekStart: string;
  ready: boolean;
}

type Action =
  | { type: "ready"; weeks: PlanWeek[] }
  | { type: "set-weeks"; weeks: PlanWeek[] }
  | { type: "upsert-week"; week: PlanWeek }
  | { type: "set-entries"; weekId: string | null; entries: PlanEntry[] }
  | { type: "apply-entry"; entry: PlanEntry }
  | { type: "apply-remote-entry"; entry: PlanEntry }
  | { type: "remove-entry"; id: string }
  | { type: "view-week"; weekStart: string };

function sortWeeks(weeks: PlanWeek[]): PlanWeek[] {
  return [...weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ready":
      return { ...state, ready: true, weeks: sortWeeks(action.weeks) };
    case "set-weeks":
      return { ...state, weeks: sortWeeks(action.weeks) };
    case "upsert-week": {
      const rest = state.weeks.filter((w) => w.id !== action.week.id);
      return { ...state, weeks: sortWeeks([...rest, action.week]) };
    }
    case "set-entries": {
      // Ignore late results for a week we already navigated away from.
      const viewed = state.weeks.find(
        (w) => w.weekStart === state.viewedWeekStart,
      );
      if (action.weekId !== (viewed?.id ?? null)) return state;
      return { ...state, entries: action.entries };
    }
    case "apply-entry": {
      // Optimistic local write: always apply (the user just did it). Keep the
      // entry's last SERVER updatedAt – or 0 when brand new – so the device
      // clock never enters the staleness comparison in apply-remote-entry: a
      // fast-clock phone must not be able to outrank and drop real server
      // updates from the other phones (#7).
      const prev = state.entries.find((e) => e.id === action.entry.id);
      const entry = { ...action.entry, updatedAt: prev?.updatedAt ?? 0 };
      const rest = state.entries.filter((e) => e.id !== action.entry.id);
      return {
        ...state,
        entries: [...rest, entry].sort((a, b) => a.createdAt - b.createdAt),
      };
    }
    case "apply-remote-entry": {
      // Realtime server event: drop stale or duplicate ones, comparing SERVER
      // timestamps on both sides (optimistic writes above never store a
      // client clock, so this comparison is always server-vs-server).
      const prev = state.entries.find((e) => e.id === action.entry.id);
      if (prev && prev.updatedAt >= action.entry.updatedAt) return state;
      const rest = state.entries.filter((e) => e.id !== action.entry.id);
      return {
        ...state,
        entries: [...rest, action.entry].sort(
          (a, b) => a.createdAt - b.createdAt,
        ),
      };
    }
    case "remove-entry":
      return {
        ...state,
        entries: state.entries.filter((e) => e.id !== action.id),
      };
    case "view-week":
      if (action.weekStart === state.viewedWeekStart) return state;
      return { ...state, viewedWeekStart: action.weekStart, entries: [] };
    default:
      return state;
  }
}

async function fetchWeeks(householdId: string): Promise<PlanWeek[]> {
  const minWeek = addWeeksKey(weekStartOf(new Date()), -WEEKS_BACK_LIMIT);
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, week_start_date, pushed_to_list_at, updated_at, deleted_at")
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .gte("week_start_date", minWeek)
    .order("week_start_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToWeek);
}

const ENTRY_SELECT =
  "id, meal_plan_id, date, recipe_id, title, servings, recipe_servings, created_at, updated_at, deleted_at, recipes(title, image_url)";

async function fetchEntries(planId: string): Promise<PlanEntry[]> {
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select(ENTRY_SELECT)
    .eq("meal_plan_id", planId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as EntryRow[]).map((row) => rowToEntry(row));
}

/** Like getOrCreateListId: resolve or create the plan row for a week. */
async function getOrCreatePlan(
  householdId: string,
  userId: string,
  weekStart: string,
): Promise<PlanWeek> {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, week_start_date, pushed_to_list_at, updated_at, deleted_at")
    .eq("household_id", householdId)
    .eq("week_start_date", weekStart)
    .is("deleted_at", null)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return rowToWeek(data[0]);

  const { data: created, error: insertError } = await supabase
    .from("meal_plans")
    .insert({
      household_id: householdId,
      week_start_date: weekStart,
      created_by_user_id: userId,
    })
    .select("id, week_start_date, pushed_to_list_at, updated_at, deleted_at")
    .single();
  if (!insertError) return rowToWeek(created);
  // Unique index: another phone created this week first – use theirs.
  if (insertError.code === "23505") {
    const { data: existing, error: retryError } = await supabase
      .from("meal_plans")
      .select("id, week_start_date, pushed_to_list_at, updated_at, deleted_at")
      .eq("household_id", householdId)
      .eq("week_start_date", weekStart)
      .is("deleted_at", null)
      .single();
    if (retryError) throw retryError;
    return rowToWeek(existing);
  }
  throw insertError;
}

/** The shared write: entry + ingredient snapshot (+ list share if pushed). */
async function insertPlanEntry(options: {
  entryId: string;
  planId: string;
  planPushed: boolean;
  weekStart: string;
  householdId: string;
  userId: string;
  date: string;
  recipe: Recipe;
  servings: number;
}): Promise<void> {
  const { error } = await supabase.from("meal_plan_entries").insert({
    id: options.entryId,
    meal_plan_id: options.planId,
    date: options.date,
    recipe_id: options.recipe.id,
    servings: options.servings,
    recipe_servings: options.recipe.servings,
  });
  if (error) throw error;
  if (options.recipe.ingredients.length > 0) {
    const { error: snapshotError } = await supabase
      .from("meal_plan_entry_ingredients")
      .insert(
        options.recipe.ingredients.map((ingredient, index) => ({
          entry_id: options.entryId,
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          sort_order: ingredient.sortOrder ?? index,
        })),
      );
    if (snapshotError) throw snapshotError;
  }
  // A + rails: once the week is on the list, new meals flow in. The server
  // resolves and locks the week's list itself.
  if (options.planPushed) {
    await contributeEntry(options.entryId);
  }
}

/**
 * Standalone "Add to weekly plan" for the recipe detail screen (the menu
 * item, wired 2026-07-16): no Plan-tab context needed. The Plan screen
 * picks the change up through its realtime channel.
 */
export async function addRecipeToPlan(
  householdId: string,
  userId: string,
  date: string,
  recipeId: string,
  servings: number,
): Promise<void> {
  const weekStart = weekStartOf(fromDateKey(date));
  const plan = await getOrCreatePlan(householdId, userId, weekStart);
  const recipe = await fetchRecipe(recipeId);
  await insertPlanEntry({
    entryId: Crypto.randomUUID(),
    planId: plan.id,
    planPushed: plan.pushedToListAt != null,
    weekStart,
    householdId,
    userId,
    date,
    recipe,
    servings,
  });
}

/**
 * Recipe ids by most-recently-planned, newest first ("Recent recipes",
 * Figma annotation 207:46318 + Thomas 2026-07-17): the picker surfaces the
 * family's rotation at the top instead of newest-created.
 */
export async function fetchRecentlyPlannedRecipeIds(
  householdId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("recipe_id, created_at, meal_plans!inner(household_id)")
    .eq("meal_plans.household_id", householdId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const seen: string[] = [];
  for (const row of data ?? []) {
    if (!seen.includes(row.recipe_id)) seen.push(row.recipe_id);
  }
  return seen;
}

interface MealPlanContextValue {
  ready: boolean;
  liveStatus: LiveStatus;
  /** Every week the switcher can reach, current week always included. */
  navigableWeeks: string[];
  viewedWeekStart: string;
  viewedWeek: PlanWeek | null;
  currentWeekStart: string;
  entries: PlanEntry[];
  canGoBack: boolean;
  goBack: () => void;
  goForward: () => void;
  addMealsToDays: (
    dates: string[],
    recipes: { id: string; title: string; imageUrl: string | null }[],
    servings: number,
  ) => Promise<void>;
  addManualMeal: (date: string, title: string) => Promise<void>;
  moveEntry: (entryId: string, newDate: string) => void;
  changeServings: (entryId: string, servings: number) => void;
  swapMeal: (
    entryId: string,
    recipe: { id: string; title: string; imageUrl: string | null },
    servings: number,
  ) => Promise<void>;
  removeEntry: (entryId: string) => void;
  /** The last-removed meal, offered for undo; null once undone or dismissed. */
  undoEntry: PlanEntry | null;
  /** Restore the last-removed meal (revives it, re-links to the list). */
  undoRemoveEntry: () => void;
  /** Drop the undo offer without restoring (the toast timed out). */
  dismissUndoEntry: () => void;
  pushToShoppingList: () => Promise<number>;
}

const MealPlanContext = createContext<MealPlanContextValue | null>(null);

export function useMealPlan(): MealPlanContextValue {
  const value = useContext(MealPlanContext);
  if (!value) throw new Error("useMealPlan requires MealPlanProvider");
  return value;
}

export function MealPlanProvider({ children }: { children: ReactNode }) {
  const household = useHousehold();
  const { session } = useAuth();
  const userId = session!.user.id;

  const currentWeekStart = useMemo(() => weekStartOf(new Date()), []);
  const [state, dispatch] = useReducer(reducer, {
    weeks: [],
    entries: [],
    viewedWeekStart: currentWeekStart,
    ready: false,
  });
  // The last-removed meal, kept so the undo toast can put it back (replaces
  // the old confirm dialog). A ref mirrors it for undoRemoveEntry.
  const [undoEntry, setUndoEntry] = useState<PlanEntry | null>(null);
  const undoEntryRef = useRef<PlanEntry | null>(null);
  useEffect(() => {
    undoEntryRef.current = undoEntry;
  }, [undoEntry]);
  const [liveStatus, setLive] = useState<LiveStatus>("connecting");
  // Callbacks read the latest state through a ref so they can stay stable.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const viewedWeek = useMemo(
    () =>
      state.weeks.find((w) => w.weekStart === state.viewedWeekStart) ?? null,
    [state.weeks, state.viewedWeekStart],
  );

  const refresh = useCallback(async () => {
    try {
      const weeks = await fetchWeeks(household.id);
      dispatch({ type: "set-weeks", weeks });
      const viewed = weeks.find(
        (w) => w.weekStart === stateRef.current.viewedWeekStart,
      );
      const entries = viewed ? await fetchEntries(viewed.id) : [];
      dispatch({ type: "set-entries", weekId: viewed?.id ?? null, entries });
    } catch (error) {
      console.warn("[plan] refresh failed", error);
    }
  }, [household.id]);

  // Fire-and-forget write, same shape as the shopping list: optimistic local
  // state first, refetch on any server disagreement so phones converge.
  const guard = useCallback(
    (label: string, write: () => Promise<unknown>) => {
      write().catch((error) => {
        console.warn(`[plan] ${label} failed`, error);
        refresh();
      });
    },
    [refresh],
  );

  // Boot: load the navigable weeks and the current week's entries.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const weeks = await fetchWeeks(household.id);
      if (cancelled) return;
      dispatch({ type: "ready", weeks });
      const viewed = weeks.find((w) => w.weekStart === currentWeekStart);
      if (viewed) {
        const entries = await fetchEntries(viewed.id);
        if (cancelled) return;
        dispatch({ type: "set-entries", weekId: viewed.id, entries });
      }
    })().catch((error) => {
      console.warn("[plan] initial load failed", error);
      if (!cancelled) setLive("offline");
    });
    return () => {
      cancelled = true;
    };
  }, [household.id, currentWeekStart]);

  // Realtime on the household's plans: a week created or pushed on another
  // phone appears here. Entry-level changes ride the per-week channel below.
  useEffect(() => {
    const channel = supabase
      .channel(`meal-plans-${household.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_plans",
          filter: `household_id=eq.${household.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const row = payload.new as PlanRow;
          if (row.deleted_at != null) return;
          dispatch({ type: "upsert-week", week: rowToWeek(row) });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [household.id]);

  // Realtime on the viewed week's entries. Realtime payloads carry no join,
  // so the recipe title/image resolve from local state when we have the row;
  // unknown rows (a meal added on another phone) trigger a refetch.
  useEffect(() => {
    const planId = viewedWeek?.id;
    if (!planId) return;
    const channel = supabase
      .channel(`meal-plan-entries-${planId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_plan_entries",
          filter: `meal_plan_id=eq.${planId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old.id) dispatch({ type: "remove-entry", id: old.id });
            return;
          }
          const row = payload.new as EntryRow;
          if (row.deleted_at != null) {
            dispatch({ type: "remove-entry", id: row.id });
            return;
          }
          const prev = stateRef.current.entries.find((e) => e.id === row.id);
          if (prev) {
            dispatch({
              type: "apply-remote-entry",
              entry: rowToEntry(row, prev),
            });
          } else {
            // New meal from another phone – fetch with the recipe join.
            refresh();
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setLive("live");
          refresh();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setLive("offline");
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewedWeek?.id, refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  // Refetch entries when navigating to a different existing week.
  const viewWeek = useCallback(
    (weekStart: string) => {
      dispatch({ type: "view-week", weekStart });
      const week = stateRef.current.weeks.find(
        (w) => w.weekStart === weekStart,
      );
      if (week) {
        fetchEntries(week.id)
          .then((entries) =>
            dispatch({ type: "set-entries", weekId: week.id, entries }),
          )
          .catch((error) => console.warn("[plan] entries load failed", error));
      }
    },
    [],
  );

  // The switcher's reachable weeks: existing plans plus the current week
  // (which always shows, row or not), max two weeks back.
  const navigableWeeks = useMemo(() => {
    const minWeek = addWeeksKey(currentWeekStart, -WEEKS_BACK_LIMIT);
    const set = new Set<string>([currentWeekStart]);
    for (const week of state.weeks) {
      if (week.weekStart >= minWeek) set.add(week.weekStart);
    }
    return [...set].sort();
  }, [state.weeks, currentWeekStart]);

  const viewedIndex = navigableWeeks.indexOf(state.viewedWeekStart);
  const canGoBack = viewedIndex > 0;

  const goBack = useCallback(() => {
    const index = navigableWeeks.indexOf(stateRef.current.viewedWeekStart);
    if (index > 0) viewWeek(navigableWeeks[index - 1]);
  }, [navigableWeeks, viewWeek]);

  // "›" past the last week CREATES the next one, clean (decided 2026-07-17:
  // the copy-week feature retires – "our interface is so strong that the
  // copy function is not important"). No sheet, no confirmation: an empty
  // week is harmless and immediately visible.
  const goForward = useCallback(() => {
    const index = navigableWeeks.indexOf(stateRef.current.viewedWeekStart);
    if (index >= 0 && index < navigableWeeks.length - 1) {
      viewWeek(navigableWeeks[index + 1]);
      return;
    }
    const target = addWeeksKey(stateRef.current.viewedWeekStart, 1);
    getOrCreatePlan(household.id, userId, target)
      .then((week) => {
        dispatch({ type: "upsert-week", week });
        viewWeek(target);
      })
      .catch((error) => console.warn("[plan] create week failed", error));
  }, [navigableWeeks, viewWeek, household.id, userId]);

  /** Resolve (or create) the viewed week's plan row before a first write. */
  const ensureViewedPlan = useCallback(async (): Promise<PlanWeek> => {
    const existing = stateRef.current.weeks.find(
      (w) => w.weekStart === stateRef.current.viewedWeekStart,
    );
    if (existing) return existing;
    const week = await getOrCreatePlan(
      household.id,
      userId,
      stateRef.current.viewedWeekStart,
    );
    dispatch({ type: "upsert-week", week });
    return week;
  }, [household.id, userId]);

  // Add the chosen meals to every chosen day (cross product), all at the
  // one serving count. Each recipe is fetched once, then snapshotted onto
  // an entry per day (decided 2026-07-17: multi-day works for one or many).
  const addMealsToDays = useCallback(
    async (
      dates: string[],
      recipes: { id: string; title: string; imageUrl: string | null }[],
      servings: number,
    ) => {
      const week = await ensureViewedPlan();
      // Snapshot every recipe (ingredients at base servings) BEFORE showing
      // anything: if one fetch fails, we bail with nothing on screen instead
      // of leaving optimistic meals that were never saved and vanish on the
      // next refresh (review #8). Fetching in parallel is a bonus.
      const fetched = await Promise.all(
        recipes.map((summary) => fetchRecipe(summary.id)),
      );
      const writes: { entryId: string; date: string; recipe: Recipe }[] = [];
      for (const recipe of fetched) {
        for (const date of dates) {
          const entryId = Crypto.randomUUID();
          const now = Date.now();
          dispatch({
            type: "apply-entry",
            entry: {
              id: entryId,
              planId: week.id,
              date,
              recipeId: recipe.id,
              recipeTitle: recipe.title,
              recipeImageUrl: recipe.imageUrl,
              servings,
              recipeServings: recipe.servings,
              createdAt: now,
              updatedAt: now,
            },
          });
          writes.push({ entryId, date, recipe });
        }
      }
      // ONE serialized guard for all entries: concurrent contributeEntry
      // calls each looked up the list before the others had written and
      // created duplicate lines instead of merging ("6× Avokado", found
      // on-device 2026-07-17). Sequential writes let each entry's share
      // merge into the line the previous one made.
      guard("add meals", async () => {
        for (const write of writes) {
          await insertPlanEntry({
            entryId: write.entryId,
            planId: week.id,
            planPushed: week.pushedToListAt != null,
            weekStart: week.weekStart,
            householdId: household.id,
            userId,
            date: write.date,
            recipe: write.recipe,
            servings,
          });
        }
      });
    },
    [ensureViewedPlan, guard, household.id, userId],
  );

  // A manual meal ("Leftovers", the sheet's Manual tab, designed
  // 2026-07-18): just a name on a day – no recipe, no ingredients, so it
  // never touches the shopping list. servings is stored as 1 and hidden.
  const addManualMeal = useCallback(
    async (date: string, title: string) => {
      const week = await ensureViewedPlan();
      const entryId = Crypto.randomUUID();
      const now = Date.now();
      dispatch({
        type: "apply-entry",
        entry: {
          id: entryId,
          planId: week.id,
          date,
          recipeId: null,
          recipeTitle: title,
          recipeImageUrl: null,
          servings: 1,
          recipeServings: 1,
          createdAt: now,
          updatedAt: now,
        },
      });
      guard("add manual meal", async () => {
        const { error } = await supabase.from("meal_plan_entries").insert({
          id: entryId,
          meal_plan_id: week.id,
          date,
          recipe_id: null,
          title,
          servings: 1,
          recipe_servings: 1,
        });
        if (error) throw error;
      });
    },
    [ensureViewedPlan, guard],
  );

  const moveEntry = useCallback(
    (entryId: string, newDate: string) => {
      const entry = stateRef.current.entries.find((e) => e.id === entryId);
      if (!entry) return;
      dispatch({
        type: "apply-entry",
        entry: { ...entry, date: newDate, updatedAt: Date.now() },
      });
      guard("move meal", async () => {
        const { error } = await supabase
          .from("meal_plan_entries")
          .update({ date: newDate })
          .eq("id", entryId);
        if (error) throw error;
        // Same week, same list – contributions are unaffected by the day.
      });
    },
    [guard],
  );

  const changeServings = useCallback(
    (entryId: string, servings: number) => {
      const entry = stateRef.current.entries.find((e) => e.id === entryId);
      if (!entry || entry.servings === servings) return;
      const oldServings = entry.servings;
      dispatch({
        type: "apply-entry",
        entry: { ...entry, servings, updatedAt: Date.now() },
      });
      guard("change servings", async () => {
        const { error } = await supabase
          .from("meal_plan_entries")
          .update({ servings })
          .eq("id", entryId);
        if (error) throw error;
        if (stateRef.current.weeks.find((w) => w.id === entry.planId)
          ?.pushedToListAt != null) {
          await rescaleEntry(entryId, oldServings, servings);
        }
      });
    },
    [guard],
  );

  const swapMeal = useCallback(
    async (
      entryId: string,
      summary: { id: string; title: string; imageUrl: string | null },
      servings: number,
    ) => {
      const entry = stateRef.current.entries.find((e) => e.id === entryId);
      if (!entry) return;
      const recipe = await fetchRecipe(summary.id);
      dispatch({
        type: "apply-entry",
        entry: {
          ...entry,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          recipeImageUrl: recipe.imageUrl,
          servings,
          recipeServings: recipe.servings,
          updatedAt: Date.now(),
        },
      });
      guard("swap meal", async () => {
        const entryWeek = stateRef.current.weeks.find(
          (w) => w.id === entry.planId,
        );
        const pushed = entryWeek?.pushedToListAt != null;
        // Pull the old meal's share out, replace the snapshot, put the new in.
        if (pushed) await withdrawEntry(entryId);
        const { error: clearError } = await supabase
          .from("meal_plan_entry_ingredients")
          .delete()
          .eq("entry_id", entryId);
        if (clearError) throw clearError;
        const { error } = await supabase
          .from("meal_plan_entries")
          .update({
            recipe_id: recipe.id,
            // Swapping a manual meal to a recipe: the name now comes from
            // the recipe again.
            title: null,
            servings,
            recipe_servings: recipe.servings,
          })
          .eq("id", entryId);
        if (error) throw error;
        if (recipe.ingredients.length > 0) {
          const { error: snapshotError } = await supabase
            .from("meal_plan_entry_ingredients")
            .insert(
              recipe.ingredients.map((ingredient, index) => ({
                entry_id: entryId,
                name: ingredient.name,
                quantity: ingredient.quantity,
                unit: ingredient.unit,
                sort_order: ingredient.sortOrder ?? index,
              })),
            );
          if (snapshotError) throw snapshotError;
        }
        if (pushed) {
          await contributeEntry(entryId);
        }
      });
    },
    [guard],
  );

  const removeEntry = useCallback(
    (entryId: string) => {
      const entry = stateRef.current.entries.find((e) => e.id === entryId);
      if (!entry) return;
      dispatch({ type: "remove-entry", id: entryId });
      setUndoEntry(entry);
      guard("remove meal", async () => {
        const pushed =
          stateRef.current.weeks.find((w) => w.id === entry.planId)
            ?.pushedToListAt != null;
        if (pushed) await withdrawEntry(entryId);
        const { error } = await supabase
          .from("meal_plan_entries")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", entryId);
        if (error) throw error;
      });
    },
    [guard],
  );

  const undoRemoveEntry = useCallback(() => {
    const entry = undoEntryRef.current;
    if (!entry) return;
    setUndoEntry(null);
    // Put it straight back locally (apply-entry re-sorts it into place), then
    // revive the row and re-contribute to the shopping list if the week was
    // already pushed – the mirror image of removeEntry.
    dispatch({ type: "apply-entry", entry });
    guard("restore meal", async () => {
      const pushed =
        stateRef.current.weeks.find((w) => w.id === entry.planId)
          ?.pushedToListAt != null;
      const { error } = await supabase
        .from("meal_plan_entries")
        .update({ deleted_at: null })
        .eq("id", entry.id);
      if (error) throw error;
      if (pushed) await contributeEntry(entry.id);
    });
  }, [guard]);

  const dismissUndoEntry = useCallback(() => setUndoEntry(null), []);

  const pushToShoppingList = useCallback(async () => {
    const week = await ensureViewedPlan();
    const touched = await pushPlanToList(week.id);
    dispatch({
      type: "upsert-week",
      week: {
        ...week,
        pushedToListAt: week.pushedToListAt ?? Date.now(),
        updatedAt: Date.now(),
      },
    });
    return touched;
  }, [ensureViewedPlan]);

  const value = useMemo<MealPlanContextValue>(
    () => ({
      ready: state.ready,
      liveStatus,
      navigableWeeks,
      viewedWeekStart: state.viewedWeekStart,
      viewedWeek,
      currentWeekStart,
      entries: state.entries,
      canGoBack,
      goBack,
      goForward,
      addMealsToDays,
      addManualMeal,
      moveEntry,
      changeServings,
      swapMeal,
      removeEntry,
      undoEntry,
      undoRemoveEntry,
      dismissUndoEntry,
      pushToShoppingList,
    }),
    [
      state.ready,
      state.viewedWeekStart,
      state.entries,
      liveStatus,
      navigableWeeks,
      viewedWeek,
      currentWeekStart,
      canGoBack,
      goBack,
      goForward,
      addMealsToDays,
      addManualMeal,
      moveEntry,
      changeServings,
      swapMeal,
      removeEntry,
      undoEntry,
      undoRemoveEntry,
      dismissUndoEntry,
      pushToShoppingList,
    ],
  );

  return (
    <MealPlanContext.Provider value={value}>
      {children}
    </MealPlanContext.Provider>
  );
}
