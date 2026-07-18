import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { WeekBar } from "@/components/plan/week-bar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { ServingsCounter } from "@/components/recipes/servings-counter";
import { ds } from "@/constants/ds";
import { useHousehold } from "@/lib/household-context";
import { fetchRecentlyPlannedRecipeIds } from "@/lib/meal-plan";
import {
  fetchRecipes,
  matchesSearch,
  type RecipeSummary,
} from "@/lib/recipes";

/**
 * The recipe picker sheet (Figma "Add to Monday" 207:46306 pre-selection,
 * 207:46700 post-selection – redesigned 2026-07-17). Search filters as you
 * type; zero matches show the "No recipe for X yet" banner. Progressive
 * disclosure: servings, day chips and the button appear only once a meal
 * is selected. The day-chip row replaces the earlier multi-day toggle +
 * "Which days?" second sheet – the originating day starts active, tapping
 * more chips adds more days. Add mode multi-selects recipes; swap picks
 * exactly one (no day chips – a swap stays on its day).
 *
 * Add mode carries a Recipes/Manual toggle (Figma 142:15357, 2026-07-18):
 * Manual is a name-only meal ("Leftovers") that goes to the originating day
 * and never touches the shopping list. The toggle dropped the old subtitle.
 * Swap stays recipes-only (no Manual tab designed for it).
 */
export function AddMealSheet({
  visible,
  mode,
  dayName,
  weekStart,
  originDate,
  initialServings = 4,
  onClose,
  onSubmit,
  onSubmitManual,
}: {
  visible: boolean;
  mode: "add" | "swap";
  /** "Monday" – used for the add-mode title. */
  dayName?: string;
  /** The viewed week – the day-chip row spans it (add mode). */
  weekStart?: string;
  /** The day whose "+ Add meal" opened the sheet – its chip starts active. */
  originDate?: string;
  initialServings?: number;
  onClose: () => void;
  /** dates is the chosen day set (add mode); empty in swap mode. */
  onSubmit: (
    recipes: RecipeSummary[],
    servings: number,
    dates: string[],
  ) => void;
  /** Manual tab (add mode): the typed meal name for the originating day. */
  onSubmitManual?: (title: string) => void;
}) {
  const [tab, setTab] = useState<"recipes" | "manual">("recipes");
  return (
    <BottomSheet
      visible={visible}
      title={mode === "add" ? `Add to ${dayName ?? "day"}` : "Swap meal"}
      subtitle={mode === "swap" ? "Feeling for something else?" : undefined}
      onClose={onClose}
    >
      {visible && (
        <>
          {mode === "add" && <SheetTabs tab={tab} onChange={setTab} />}
          {mode === "add" && tab === "manual" ? (
            <ManualContent
              onClose={onClose}
              onSubmit={(title) => onSubmitManual?.(title)}
            />
          ) : (
            <SheetContent
              mode={mode}
              withTabs={mode === "add"}
              weekStart={weekStart}
              originDate={originDate}
              initialServings={initialServings}
              onClose={onClose}
              onSubmit={onSubmit}
            />
          )}
        </>
      )}
    </BottomSheet>
  );
}

/**
 * The Recipes/Manual toggle (Figma tabs component 213:64759): equal halves,
 * the active one filled with the secondary brown, hairline divider between.
 * The 8px vertical margins top up the sheet shell's 16px gap to the
 * design's 24 on both sides.
 */
function SheetTabs({
  tab,
  onChange,
}: {
  tab: "recipes" | "manual";
  onChange: (tab: "recipes" | "manual") => void;
}) {
  return (
    <View className="my-layout-xsmall w-full flex-row overflow-hidden rounded-small bg-surface-neutral-white">
      <TabItem
        label="Recipes"
        active={tab === "recipes"}
        divider
        onPress={() => onChange("recipes")}
      />
      <TabItem
        label="Manual"
        active={tab === "manual"}
        onPress={() => onChange("manual")}
      />
    </View>
  );
}

function TabItem({
  label,
  active,
  divider = false,
  onPress,
}: {
  label: string;
  active: boolean;
  divider?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={
        "flex-1 items-center justify-center px-layout-xsmall py-layout-small " +
        (active ? "bg-surface-secondary-main " : "") +
        (divider ? "border-r border-surface-neutral-lightest" : "")
      }
    >
      <Text
        className={
          "font-paragraph text-small font-emphasized leading-xxsmall " +
          (active ? "text-text-inverse" : "text-text-default")
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The Manual tab (Figma 213:64576): one labelled name field and the button.
 * No servings, no day chips – the meal lands on the originating day. The
 * design draws the button enabled next to an empty field; it disables here
 * until a name is typed (same pattern as the recipes tab), flagged in the
 * backlog.
 */
function ManualContent({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const canSubmit = title.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    onSubmit(title.trim());
    onClose();
  };
  return (
    <View className="w-full gap-layout-medium">
      <View className="w-full gap-comp-small">
        <Text className="font-paragraph text-components-label font-default leading-xxsmall text-text-subtle">
          Name of meal
        </Text>
        <Input
          value={title}
          onChangeText={setTitle}
          // Reworded from the frame's Danish "Fx Pasta al Pomodoro"
          // (approved by Thomas 2026-07-18) – update the Figma copy too.
          placeholder="E.g. leftovers"
          accessibilityLabel="Name of meal"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit}
        onPress={submit}
        className={
          // No button/*/disabled token in the DS yet (flagged in backlog).
          "w-full items-center rounded-medium py-comp-large " +
          (canSubmit
            ? "bg-button-solid-fill-enabled"
            : "bg-surface-neutral-light")
        }
      >
        <Text
          className={
            "font-paragraph text-components-button-label font-default " +
            (canSubmit
              ? "text-button-solid-label-enabled"
              : "text-text-disabled")
          }
        >
          Add to plan
        </Text>
      </Pressable>
    </View>
  );
}

function SheetContent({
  mode,
  withTabs = false,
  weekStart,
  originDate,
  initialServings,
  onClose,
  onSubmit,
}: {
  mode: "add" | "swap";
  /** The tab row above takes ~64px – the list gives that height back. */
  withTabs?: boolean;
  weekStart?: string;
  originDate?: string;
  initialServings: number;
  onClose: () => void;
  onSubmit: (
    recipes: RecipeSummary[],
    servings: number,
    dates: string[],
  ) => void;
}) {
  const household = useHousehold();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [servings, setServings] = useState(initialServings);
  // Day chips (add mode): the originating day starts active; tapping more
  // chips sends the meal(s) to more days (design 207:46700). Past days get
  // no chip at all (design 207:48288 – planning happens Sunday-for-the-week
  // or forward, never backward).
  const [selectedDates, setSelectedDates] = useState<string[]>(
    originDate ? [originDate] : [],
  );
  const toggleDate = (date: string) => {
    setSelectedDates((current) =>
      current.includes(date)
        ? current.filter((d) => d !== date)
        : [...current, date],
    );
  };

  useEffect(() => {
    let cancelled = false;
    // Recent recipes first (Thomas, 2026-07-17): the family's rotation
    // floats to the top, the rest keep their newest-created order.
    Promise.all([
      fetchRecipes(household.id),
      fetchRecentlyPlannedRecipeIds(household.id).catch(() => [] as string[]),
    ])
      .then(([rows, recentIds]) => {
        if (cancelled) return;
        const rank = new Map(recentIds.map((id, index) => [id, index]));
        setRecipes(
          [...rows].sort(
            (a, b) =>
              (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
              (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
          ),
        );
      })
      .catch((error) => console.warn("[plan] recipes fetch failed", error));
    return () => {
      cancelled = true;
    };
  }, [household.id]);

  const visible = useMemo(
    () =>
      (recipes ?? []).filter(
        (recipe) =>
          (!favoritesOnly || recipe.isFavorite) && matchesSearch(recipe, query),
      ),
    [recipes, favoritesOnly, query],
  );

  const toggle = (recipe: RecipeSummary) => {
    setSelected((current) => {
      if (current.includes(recipe.id))
        return current.filter((id) => id !== recipe.id);
      // Swap picks exactly one; add multi-selects (decided 2026-07-16).
      return mode === "swap" ? [recipe.id] : [...current, recipe.id];
    });
  };

  const submit = () => {
    const picked = (recipes ?? []).filter((r) => selected.includes(r.id));
    if (picked.length === 0) return;
    if (mode === "add" && selectedDates.length === 0) return;
    onSubmit(picked, servings, mode === "add" ? selectedDates : []);
    onClose();
  };

  const addRecipe = () => {
    onClose();
    router.push({
      pathname: "/recipes/new",
      params: query.trim() ? { title: query.trim() } : undefined,
    });
  };

  const hasSelection = selected.length > 0;
  const canSubmit =
    hasSelection && (mode !== "add" || selectedDates.length > 0);

  // The sheet takes most of the screen (feedback 2026-07-16) but shrinks
  // when the keyboard opens, so the search field never leaves the screen –
  // the KeyboardAvoidingView shell pushes the card up, the content gives
  // the height back.
  const keyboardHeight = useKeyboardHeight();
  const contentHeight = Math.min(
    height * (withTabs ? 0.7 : 0.78),
    height - keyboardHeight - 200,
  );

  return (
    <View className="w-full gap-layout-small" style={{ height: contentHeight }}>
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
      <FlatList
        data={visible}
        keyExtractor={(recipe) => recipe.id}
        className="flex-1"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <PickerRow
            recipe={item}
            selected={selected.includes(item.id)}
            onPress={() => toggle(item)}
          />
        )}
        ListEmptyComponent={
          recipes == null ? null : (
            <EmptySearch query={query.trim()} onAddRecipe={addRecipe} />
          )
        }
      />
      {/* Progressive disclosure (design 207:46306 vs 207:46700): servings,
          day chips and the button exist only once a meal is picked. */}
      {hasSelection && (
        <>
          <ServingsCounter value={servings} onChange={setServings} />
          {mode === "add" && weekStart != null && (
            <WeekBar
              weekStart={weekStart}
              selectedDates={selectedDates}
              onToggle={toggleDate}
            />
          )}
          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={submit}
            className={
              // mt 8 + the container's 16 gap = the design's 24 between the
              // chips and the button (Thomas widened it, 2026-07-17). No
              // button/*/disabled token in the DS yet (flagged in backlog).
              "mt-layout-xsmall w-full items-center rounded-medium py-comp-large " +
              (canSubmit
                ? "bg-button-solid-fill-enabled"
                : "bg-surface-neutral-light")
            }
          >
            <Text
              className={
                "font-paragraph text-components-button-label font-default " +
                (canSubmit
                  ? "text-button-solid-label-enabled"
                  : "text-text-disabled")
              }
            >
              {mode === "add" ? "Add to plan" : "Swap meal"}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function PickerRow({
  recipe,
  selected,
  onPress,
}: {
  recipe: RecipeSummary;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={
        "w-full flex-row items-center gap-comp-small rounded-medium bg-surface-neutral-white py-comp-small pl-comp-small pr-comp-large " +
        (selected ? "border-2 border-surface-primary-main" : "")
      }
    >
      {recipe.imageUrl ? (
        <Image
          source={{ uri: recipe.imageUrl }}
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
          {recipe.title}
        </Text>
        {recipe.totalMinutes != null && (
          <View className="flex-row items-center gap-comp-small">
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
      {selected && (
        <MaterialIcons
          name="check-circle"
          size={24}
          color={ds.colors.text.default}
        />
      )}
    </Pressable>
  );
}

/**
 * Zero search matches (Figma 151:36815): the search term is not in the
 * library yet – offer to create it, pre-filling the new recipe's title.
 */
function EmptySearch({
  query,
  onAddRecipe,
}: {
  query: string;
  onAddRecipe: () => void;
}) {
  return (
    <View className="w-full rounded-large bg-surface-neutral-white p-layout-small">
      <MaterialIcons
        name="search"
        size={40}
        color={ds.colors.surface.primary.main}
      />
      <View className="w-full gap-comp-small pt-layout-small">
        <Text className="font-header text-display-5 font-emphasized leading-small text-text-default">
          {query ? `No recipe for “${query}” yet` : "No recipes yet"}
        </Text>
        <Text className="font-paragraph text-small font-default leading-xxsmall text-text-default">
          You don&apos;t have this one in your library – add it below.
        </Text>
      </View>
      <Pressable
        onPress={onAddRecipe}
        accessibilityRole="button"
        className="mt-layout-small w-full items-center rounded-medium border-2 border-button-outline-border-enabled py-comp-large"
      >
        <Text className="font-paragraph text-components-button-label font-default text-text-subtle">
          Add recipe
        </Text>
      </Pressable>
    </View>
  );
}

function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return keyboardHeight;
}

/** Same search input as the recipes list, plus a clear button. */
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
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <MaterialIcons
            name="close"
            size={20}
            color={ds.colors.icon.default}
          />
        </Pressable>
      )}
    </View>
  );
}
