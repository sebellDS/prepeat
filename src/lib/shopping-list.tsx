// The household's shared shopping list, backed by Supabase (shopping_lists,
// shopping_list_items, item_category_memory, households.category_order).
//
// Sync model: every action applies to local state immediately (taps must
// feel instant in a store aisle) and the write goes to Supabase in the
// background – last write wins via updated_at, per projektgrundlag. A
// realtime channel on shopping_list_items streams the other phones' changes
// in; our own writes echo back through the same channel and merge
// harmlessly. On reconnect and app foreground the list is refetched, which
// also picks up non-realtime household prefs (learned categories, category
// order).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
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
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useHousehold } from '@/lib/household-context';
import { formatQuantity, parseQuantity } from '@/lib/quantity';
import { supabase } from '@/lib/supabase';

// v1 category set (projektgrundlag decision #7): fixed constants in app code.
// Order here is the default display order until the household reorders.
export const CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat & Fish',
  'Bakery',
  'Frozen',
  'Pantry',
  'Drinks',
  'Household',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface ShoppingItem {
  id: string;
  name: string;
  // Single display string in the UI ("250 g"); split into numeric quantity
  // + unit text at the database boundary (see lib/quantity.ts).
  quantity: string | null;
  // null = not categorized yet; such items show at the top of the list until
  // the household teaches the app where they belong.
  aisle: Category | null;
  isChecked: boolean;
  checkedByInitial: string | null;
  checkedAt: number | null;
  // UI-only: a checked item lingers in its category group until it settles
  // into the done section (forgiving of accidental taps).
  settled: boolean;
  // Server timestamp (ms) used to drop stale realtime events.
  updatedAt: number;
}

export type LiveStatus = 'connecting' | 'live' | 'offline';

// How long a freshly checked item stays in its category group before moving
// down to the done section (design decision: forgiving of accidental taps).
export const LINGER_MS = 1500;

export function normalizeItemName(name: string): string {
  // Same rule as ingredient merging: trimmed, lowercased. Also collapse
  // whitespace (incl. non-breaking spaces) so near-identical entries match.
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

// A shopping_list_items row as PostgREST returns it.
interface ItemRow {
  id: string;
  name: string;
  quantity: number | string | null;
  unit: string | null;
  aisle: string | null;
  is_checked: boolean;
  checked_by_initial: string | null;
  checked_at: string | null;
  updated_at: string;
  deleted_at: string | null;
}

function toCategory(aisle: string | null): Category | null {
  return (CATEGORIES as readonly string[]).includes(aisle ?? '') ? (aisle as Category) : null;
}

function rowToItem(row: ItemRow, prev?: ShoppingItem): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    quantity: formatQuantity(row.quantity == null ? null : Number(row.quantity), row.unit),
    aisle: toCategory(row.aisle),
    isChecked: row.is_checked,
    checkedByInitial: row.checked_by_initial,
    checkedAt: row.checked_at ? Date.parse(row.checked_at) : null,
    // A check from another phone goes straight to the done section; our own
    // check keeps its local linger state so the realtime echo of the write
    // does not restart it.
    settled: row.is_checked ? (prev?.isChecked ? prev.settled : true) : false,
    updatedAt: Date.parse(row.updated_at),
  };
}

interface State {
  loading: boolean;
  listId: string | null;
  items: ShoppingItem[];
  // The household's learned name -> category mapping (item_category_memory).
  memory: Record<string, Category>;
  // Display order of category groups – the household's walk through the
  // store, stored on the household row.
  categoryOrder: Category[];
}

type Action =
  | {
      type: 'ready';
      listId: string;
      rows: ItemRow[];
      memory: Record<string, Category>;
      categoryOrder: Category[];
    }
  | { type: 'refresh'; rows: ItemRow[]; memory: Record<string, Category>; categoryOrder: Category[] }
  | { type: 'apply-row'; row: ItemRow }
  | { type: 'remove-row'; id: string }
  | { type: 'add'; name: string; id: string; now: number }
  | { type: 'toggle'; id: string; now: number; initial: string }
  | { type: 'settle'; id: string }
  | {
      type: 'update';
      id: string;
      name: string;
      quantity: string | null;
      aisle: Category | null;
    }
  | { type: 'remove'; id: string }
  | { type: 'fill'; items: ShoppingItem[] }
  | { type: 'set-order'; order: Category[] };

function mergeRows(prevItems: ShoppingItem[], rows: ItemRow[]): ShoppingItem[] {
  const prevById = new Map(prevItems.map((item) => [item.id, item]));
  return rows
    .filter((row) => row.deleted_at == null)
    .map((row) => rowToItem(row, prevById.get(row.id)));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ready':
      return {
        loading: false,
        listId: action.listId,
        items: mergeRows(state.items, action.rows),
        memory: action.memory,
        categoryOrder: action.categoryOrder,
      };
    case 'refresh':
      return {
        ...state,
        items: mergeRows(state.items, action.rows),
        memory: action.memory,
        categoryOrder: action.categoryOrder,
      };
    case 'apply-row': {
      const incoming = Date.parse(action.row.updated_at);
      const prev = state.items.find((item) => item.id === action.row.id);
      // Stale events (older than what we already show) are dropped; echoes
      // of our own writes re-apply the same values, which is harmless.
      if (prev && prev.updatedAt >= incoming) return state;
      const item = rowToItem(action.row, prev);
      return {
        ...state,
        items: prev
          ? state.items.map((existing) => (existing.id === item.id ? item : existing))
          : [...state.items, item],
      };
    }
    case 'remove-row':
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    case 'add': {
      // Unknown names stay uncategorized (top of the list) until taught.
      const aisle = state.memory[normalizeItemName(action.name)] ?? null;
      const item: ShoppingItem = {
        id: action.id,
        name: action.name,
        quantity: null,
        aisle,
        isChecked: false,
        checkedByInitial: null,
        checkedAt: null,
        settled: false,
        updatedAt: action.now,
      };
      return { ...state, items: [...state.items, item] };
    }
    case 'toggle': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id
            ? item.isChecked
              ? {
                  ...item,
                  isChecked: false,
                  checkedByInitial: null,
                  checkedAt: null,
                  settled: false,
                }
              : {
                  ...item,
                  isChecked: true,
                  checkedByInitial: action.initial,
                  checkedAt: action.now,
                }
            : item,
        ),
      };
    }
    case 'settle': {
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id && item.isChecked ? { ...item, settled: true } : item,
        ),
      };
    }
    case 'update': {
      const prev = state.items.find((item) => item.id === action.id);
      if (!prev) return state;
      const name = action.name.replace(/\s+/g, ' ').trim() || prev.name;
      // Teaching moment: an explicit category choice is remembered for the
      // household and applied to every future item with the same name.
      const memory =
        action.aisle === prev.aisle || action.aisle == null
          ? state.memory
          : { ...state.memory, [normalizeItemName(name)]: action.aisle };
      return {
        ...state,
        memory,
        items: state.items.map((item) =>
          item.id === action.id
            ? { ...item, name, quantity: action.quantity, aisle: action.aisle }
            : item,
        ),
      };
    }
    case 'remove':
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    case 'fill':
      return { ...state, items: [...state.items, ...action.items] };
    case 'set-order':
      return { ...state, categoryOrder: action.order };
  }
}

// Device storage key from the pre-Supabase era. Read once to migrate a
// phone's learned categories and category order up to the household, then
// deleted – the household row is the source of truth now.
const LEGACY_STORAGE_KEY = 'prepeat.shopping.household-prefs.v1';

function sanitizeOrder(order: unknown): Category[] {
  const valid = Array.isArray(order)
    ? (order.filter((c) => (CATEGORIES as readonly string[]).includes(c)) as Category[])
    : [];
  // Categories added in app updates fall back to the end of the list.
  return [...valid, ...CATEGORIES.filter((c) => !valid.includes(c))];
}

function sanitizeMemory(value: unknown): Record<string, Category> {
  const memory: Record<string, Category> = {};
  if (value && typeof value === 'object') {
    for (const [name, aisle] of Object.entries(value)) {
      const category = toCategory(typeof aisle === 'string' ? aisle : null);
      if (category) memory[normalizeItemName(name)] = category;
    }
  }
  return memory;
}

// Placeholder until the weekly plan exists: the sample basket from the Figma
// flows, complete with aisles as if snapshotted from recipes.
const SAMPLE_BASKET: [string, string | null, Category][] = [
  ['Fresh basil', '1 bunch', 'Produce'],
  ['Cherry tomatoes', '250g', 'Produce'],
  ['Zucchini', '2 pcs', 'Produce'],
  ['Parmesan', null, 'Dairy'],
  ['Whole milk', '4 Liters', 'Dairy'],
  ['Mozzarella', '2 balls', 'Dairy'],
  ['Chicken breast', '500 g', 'Meat & Fish'],
  ['Rye bread', null, 'Bakery'],
  ['Toast bread', null, 'Bakery'],
  ['Spinach', null, 'Frozen'],
  ['Ice cream', null, 'Frozen'],
  ['Smoothie mix', null, 'Frozen'],
  ['Pasta penne', '500 g', 'Pantry'],
  ['Olive oil', '1 bottle', 'Pantry'],
  ['Canned tomatoes', '2 cans', 'Pantry'],
  ['Beer', null, 'Drinks'],
  ['Dishwashing soap', null, 'Household'],
  ['Plastic bags', null, 'Household'],
  ['Tape', null, 'Other'],
];

async function getOrCreateListId(householdId: string, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return data[0].id;

  const { data: created, error: insertError } = await supabase
    .from('shopping_lists')
    .insert({ household_id: householdId, created_by_user_id: userId })
    .select('id')
    .single();
  if (!insertError) return created.id;
  // Unique index: another phone created the list first – use theirs.
  if (insertError.code === '23505') {
    const { data: existing, error: retryError } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('household_id', householdId)
      .is('deleted_at', null)
      .limit(1)
      .single();
    if (retryError) throw retryError;
    return existing.id;
  }
  throw insertError;
}

async function fetchItems(listId: string): Promise<ItemRow[]> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select(
      'id, name, quantity, unit, aisle, is_checked, checked_by_initial, checked_at, updated_at, deleted_at',
    )
    .eq('list_id', listId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchPrefs(
  householdId: string,
): Promise<{ memory: Record<string, Category>; categoryOrder: Category[] | null }> {
  const [memoryResult, householdResult] = await Promise.all([
    supabase.from('item_category_memory').select('name, aisle').eq('household_id', householdId),
    supabase.from('households').select('category_order').eq('id', householdId).single(),
  ]);
  if (memoryResult.error) throw memoryResult.error;
  if (householdResult.error) throw householdResult.error;

  const memory: Record<string, Category> = {};
  for (const row of memoryResult.data ?? []) {
    const category = toCategory(row.aisle);
    if (category) memory[row.name] = category;
  }
  const order = householdResult.data?.category_order;
  return { memory, categoryOrder: order == null ? null : sanitizeOrder(order) };
}

// One-time move of this phone's pre-Supabase prefs up to the household, so
// nothing the family taught the app is lost. Only fills gaps: an empty
// household inherits the device's memory/order; a household that already
// has data wins.
async function migrateDevicePrefs(
  householdId: string,
  server: { memory: Record<string, Category>; categoryOrder: Category[] | null },
): Promise<{ memory: Record<string, Category>; categoryOrder: Category[] | null }> {
  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return server;
  let result = server;
  try {
    const parsed = JSON.parse(raw);
    const localMemory = sanitizeMemory(parsed?.memory);
    if (Object.keys(server.memory).length === 0 && Object.keys(localMemory).length > 0) {
      const { error } = await supabase.from('item_category_memory').upsert(
        Object.entries(localMemory).map(([name, aisle]) => ({
          household_id: householdId,
          name,
          aisle,
        })),
        { onConflict: 'household_id,name' },
      );
      if (error) throw error;
      result = { ...result, memory: localMemory };
    }
    if (server.categoryOrder == null && Array.isArray(parsed?.categoryOrder)) {
      const order = sanitizeOrder(parsed.categoryOrder);
      const { error } = await supabase
        .from('households')
        .update({ category_order: order })
        .eq('id', householdId);
      if (error) throw error;
      result = { ...result, categoryOrder: order };
    }
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Best effort: keep the device copy and try again next launch.
  }
  return result;
}

interface ShoppingListApi {
  loading: boolean;
  live: LiveStatus;
  items: ShoppingItem[];
  categoryOrder: Category[];
  addItem: (name: string) => void;
  toggleItem: (id: string) => void;
  updateItem: (
    id: string,
    fields: { name: string; quantity: string | null; aisle: Category | null },
  ) => void;
  removeItem: (id: string) => void;
  fillFromWeeklyPlan: () => void;
  setCategoryOrder: (order: Category[]) => void;
}

const ShoppingListContext = createContext<ShoppingListApi | null>(null);

export function ShoppingListProvider({ children }: { children: ReactNode }) {
  const household = useHousehold();
  const { session, firstName } = useAuth();
  // Behind the onboarding gate both always exist.
  const userId = session?.user?.id ?? '';
  const initial = firstName ? firstName[0].toUpperCase() : '?';

  const [state, dispatch] = useReducer(reducer, {
    loading: true,
    listId: null,
    items: [],
    memory: {},
    categoryOrder: [...CATEGORIES],
  });
  const [live, setLive] = useState<LiveStatus>('connecting');

  // Callbacks read the latest state through a ref so they can stay stable.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Refetch everything (items + household prefs) and merge over local state.
  // Used on reconnect and app foreground – it also picks up learned
  // categories and category order, which deliberately have no realtime.
  const refresh = useCallback(async () => {
    const listId = stateRef.current.listId;
    if (!listId) return;
    try {
      const [rows, prefs] = await Promise.all([fetchItems(listId), fetchPrefs(household.id)]);
      dispatch({
        type: 'refresh',
        rows,
        memory: prefs.memory,
        categoryOrder: sanitizeOrder(prefs.categoryOrder ?? stateRef.current.categoryOrder),
      });
    } catch (error) {
      console.warn('[shopping] refresh failed', error);
    }
  }, [household.id]);

  // Fire-and-forget write: local state is already updated optimistically;
  // if the server disagrees, refetch so the phones converge on its truth.
  const guard = useCallback(
    (label: string, write: PromiseLike<{ error: { message: string } | null }>) => {
      write.then(
        ({ error }) => {
          if (error) {
            console.warn(`[shopping] ${label} failed`, error.message);
            refresh();
          }
        },
        (error) => {
          console.warn(`[shopping] ${label} failed`, error);
          refresh();
        },
      );
    },
    [refresh],
  );

  // Boot: resolve the household's single active list (creating it on first
  // run), load everything, and migrate legacy device prefs up.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const listId = await getOrCreateListId(household.id, userId);
      const serverPrefs = await fetchPrefs(household.id);
      const prefs = await migrateDevicePrefs(household.id, serverPrefs);
      const rows = await fetchItems(listId);
      if (cancelled) return;
      dispatch({
        type: 'ready',
        listId,
        rows,
        memory: prefs.memory,
        categoryOrder: prefs.categoryOrder ?? [...CATEGORIES],
      });
    })().catch((error) => {
      console.warn('[shopping] initial load failed', error);
      if (!cancelled) setLive('offline');
    });
    return () => {
      cancelled = true;
    };
  }, [household.id, userId]);

  // Realtime: stream the other phones' item changes into local state. The
  // subscribe status doubles as the Live badge; every (re)subscribe refetches
  // to cover anything missed while disconnected.
  useEffect(() => {
    const listId = state.listId;
    if (!listId) return;
    const channel = supabase
      .channel(`shopping-list-${listId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list_items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id?: string };
            if (old.id) dispatch({ type: 'remove-row', id: old.id });
            return;
          }
          const row = payload.new as ItemRow;
          if (row.deleted_at != null) {
            dispatch({ type: 'remove-row', id: row.id });
          } else {
            dispatch({ type: 'apply-row', row });
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLive('live');
          refresh();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setLive('offline');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.listId, refresh]);

  // Coming back to the foreground refetches: realtime reconnects on its own,
  // but events missed while backgrounded would otherwise leave stale state.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const addItem = useCallback(
    (name: string) => {
      const trimmed = name.replace(/\s+/g, ' ').trim();
      const listId = stateRef.current.listId;
      if (!trimmed || !listId) return;
      const id = Crypto.randomUUID();
      dispatch({ type: 'add', name: trimmed, id, now: Date.now() });
      const aisle = stateRef.current.memory[normalizeItemName(trimmed)] ?? null;
      guard(
        'add',
        supabase.from('shopping_list_items').insert({
          id,
          list_id: listId,
          name: trimmed,
          aisle,
          created_by_user_id: userId,
        }),
      );
    },
    [guard, userId],
  );

  const toggleItem = useCallback(
    (id: string) => {
      const item = stateRef.current.items.find((candidate) => candidate.id === id);
      if (!item) return;
      const now = Date.now();
      dispatch({ type: 'toggle', id, now, initial });
      // After the linger window the item settles into the done section (the
      // settle action is a no-op if it was unchecked again in the meantime).
      setTimeout(() => dispatch({ type: 'settle', id }), LINGER_MS);
      guard(
        'toggle',
        supabase
          .from('shopping_list_items')
          .update(
            item.isChecked
              ? {
                  is_checked: false,
                  checked_by_user_id: null,
                  checked_by_initial: null,
                  checked_at: null,
                }
              : {
                  is_checked: true,
                  checked_by_user_id: userId,
                  checked_by_initial: initial,
                  checked_at: new Date(now).toISOString(),
                },
          )
          .eq('id', id),
      );
    },
    [guard, userId, initial],
  );

  const updateItem = useCallback(
    (id: string, fields: { name: string; quantity: string | null; aisle: Category | null }) => {
      const prev = stateRef.current.items.find((candidate) => candidate.id === id);
      if (!prev) return;
      dispatch({ type: 'update', id, ...fields });
      const name = fields.name.replace(/\s+/g, ' ').trim() || prev.name;
      const { quantity, unit } = parseQuantity(fields.quantity);
      guard(
        'update',
        supabase
          .from('shopping_list_items')
          .update({ name, quantity, unit, aisle: fields.aisle })
          .eq('id', id),
      );
      if (fields.aisle != null && fields.aisle !== prev.aisle) {
        guard(
          'teach category',
          supabase.from('item_category_memory').upsert(
            { household_id: household.id, name: normalizeItemName(name), aisle: fields.aisle },
            { onConflict: 'household_id,name' },
          ),
        );
      }
    },
    [guard, household.id],
  );

  const removeItem = useCallback(
    (id: string) => {
      dispatch({ type: 'remove', id });
      guard(
        'remove',
        supabase
          .from('shopping_list_items')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id),
      );
    },
    [guard],
  );

  const setCategoryOrder = useCallback(
    (order: Category[]) => {
      const next = sanitizeOrder(order);
      dispatch({ type: 'set-order', order: next });
      guard(
        'reorder',
        supabase.from('households').update({ category_order: next }).eq('id', household.id),
      );
    },
    [guard, household.id],
  );

  const fillFromWeeklyPlan = useCallback(() => {
    const listId = stateRef.current.listId;
    if (!listId) return;
    const now = Date.now();
    const rows = SAMPLE_BASKET.map(([name, quantityText, aisle]) => {
      const { quantity, unit } = parseQuantity(quantityText);
      return {
        id: Crypto.randomUUID(),
        list_id: listId,
        name,
        quantity,
        unit,
        aisle,
        added_manually: false,
        created_by_user_id: userId,
      };
    });
    dispatch({
      type: 'fill',
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        quantity: formatQuantity(row.quantity, row.unit),
        aisle: row.aisle,
        isChecked: false,
        checkedByInitial: null,
        checkedAt: null,
        settled: false,
        updatedAt: now,
      })),
    });
    guard('fill from plan', supabase.from('shopping_list_items').insert(rows));
  }, [guard, userId]);

  const api = useMemo(
    () => ({
      loading: state.loading,
      live,
      items: state.items,
      categoryOrder: state.categoryOrder,
      addItem,
      toggleItem,
      updateItem,
      removeItem,
      fillFromWeeklyPlan,
      setCategoryOrder,
    }),
    [
      state.loading,
      live,
      state.items,
      state.categoryOrder,
      addItem,
      toggleItem,
      updateItem,
      removeItem,
      fillFromWeeklyPlan,
      setCategoryOrder,
    ],
  );

  return <ShoppingListContext.Provider value={api}>{children}</ShoppingListContext.Provider>;
}

export function useShoppingList(): ShoppingListApi {
  const ctx = useContext(ShoppingListContext);
  if (!ctx) throw new Error('useShoppingList must be used inside ShoppingListProvider');
  return ctx;
}
