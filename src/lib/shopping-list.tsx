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
import { useFocusEffect } from 'expo-router';
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
import { pushPlanToList } from '@/lib/plan-shopping';
import { formatQuantity, parseQuantity } from '@/lib/quantity';
import {
  CATEGORIES,
  getOrCreateListId,
  moveWeekLeftovers,
  normalizeItemName,
  undoMoveWeekLeftovers,
  type Category,
  type MoveReceipt,
} from '@/lib/shopping-core';
import { supabase } from '@/lib/supabase';
import { useCurrentWeekStart } from '@/lib/use-today';
import { addWeeksKey } from '@/lib/week';

// Moved to shopping-core.ts (2026-07-16, plan milestone) – re-exported so
// existing imports keep working.
export {
  CATEGORIES,
  getOrCreateListId,
  normalizeItemName,
  type Category,
} from '@/lib/shopping-core';

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
  // Who checked it – the done section styles your own checks differently
  // from the rest of the household's.
  checkedByUserId: string | null;
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
// Short – the move itself is animated, so the linger only needs to absorb
// an immediate "oops" re-tap (1.5s → 0.6s → 0.4s → 0.2s, Thomas 2026-07-08).
export const LINGER_MS = 200;

// A shopping_list_items row as PostgREST returns it.
interface ItemRow {
  id: string;
  name: string;
  quantity: number | string | null;
  unit: string | null;
  aisle: string | null;
  is_checked: boolean;
  checked_by_initial: string | null;
  checked_by_user_id: string | null;
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
    checkedByUserId: row.checked_by_user_id,
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
  // A load actually FAILED, as opposed to still being in flight. Before this
  // (audit 2026-08-02, finding 5) a failed week switch left loading:true with
  // an empty list forever, and the screen inferred failure from
  // "loading && offline" – which missed every server-side failure, like the
  // 2026-07-27 outage, showing a blank list with no spinner and no message.
  failed: boolean;
  listId: string | null;
  items: ShoppingItem[];
  // The household's learned name -> category mapping (item_category_memory).
  memory: Record<string, Category>;
  // Display order of category groups – the household's walk through the
  // store, stored on the household row.
  categoryOrder: Category[];
  // What the last delete took away, kept so the undo toast can put it back:
  // one item for a swipe-delete, the whole batch for "Clear done items"
  // (2026-07-25 – bulk clear is the most destructive action on the list and
  // was the only one without an undo). Empty = nothing to undo. Lives in
  // reducer state, not a ref, so the snapshot always sees the true current
  // items rather than a render-behind copy.
  removed: ShoppingItem[];
  // Set when `removed` left via "Move all items to this week" (2026-08-03).
  // That undo cannot just clear deleted_at: the items also arrived on another
  // week, where they may have merged into a line that was already there. The
  // server's receipt is what reverses both halves exactly.
  moveReceipt: MoveReceipt | null;
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
  | { type: 'toggle'; id: string; now: number; initial: string; userId: string }
  | { type: 'settle'; id: string }
  | {
      type: 'update';
      id: string;
      name: string;
      quantity: string | null;
      aisle: Category | null;
    }
  | { type: 'remove'; id: string }
  | { type: 'clear-completed' }
  // Two halves of the week move: the items leave the screen the instant the
  // button is pressed, and the undo offer only appears once the server has
  // confirmed what it actually did (there is nothing to undo before that).
  | { type: 'move-out'; ids: string[] }
  | { type: 'moved'; items: ShoppingItem[]; receipt: MoveReceipt }
  | { type: 'restore' }
  | { type: 'dismiss-undo' }
  | { type: 'set-order'; order: Category[] }
  // Week switch in flight: blank the list so the old week's items never
  // show under the new week's label.
  | { type: 'begin-load' }
  | { type: 'load-failed' };

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
        failed: false,
        listId: action.listId,
        items: mergeRows(state.items, action.rows),
        memory: action.memory,
        categoryOrder: action.categoryOrder,
        // A week switch clears the pending undo in 'begin-load'; a plain
        // (re)load must not swallow a toast the shopper is still looking at.
        removed: state.removed,
        moveReceipt: state.moveReceipt,
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
        checkedByUserId: null,
        checkedAt: null,
        settled: false,
        // No server timestamp yet: 0 so the insert's own realtime echo (and
        // later remote edits) always apply. Stamping the device clock here let
        // a fast-clock phone outrank real server updates and drop them (#7).
        updatedAt: 0,
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
                  checkedByUserId: null,
                  checkedAt: null,
                  settled: false,
                }
              : {
                  ...item,
                  isChecked: true,
                  checkedByInitial: action.initial,
                  checkedByUserId: action.userId,
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
    case 'remove': {
      // Snapshot from the live state here, so undo always has the exact row.
      const removed = state.items.find((item) => item.id === action.id);
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.id),
        removed: removed ? [removed] : [],
        moveReceipt: null,
      };
    }
    case 'clear-completed': {
      // The whole done section leaves at once – snapshot every row it took so
      // one Undo brings them all back, not just the last.
      const cleared = state.items.filter((item) => item.isChecked);
      if (cleared.length === 0) return state;
      return {
        ...state,
        items: state.items.filter((item) => !item.isChecked),
        removed: cleared,
        moveReceipt: null,
      };
    }
    case 'move-out': {
      // Optimistic half: the past week empties immediately, which also takes
      // the button away with it (it only exists where there is something to
      // move). No undo offer yet – see 'moved'.
      const ids = new Set(action.ids);
      return {
        ...state,
        items: state.items.filter((item) => !ids.has(item.id)),
        removed: [],
        moveReceipt: null,
      };
    }
    case 'moved':
      // The server has confirmed the move, so it can now be taken back.
      return { ...state, removed: action.items, moveReceipt: action.receipt };
    case 'restore': {
      // Undo: put the snapshot(s) back. Anything a realtime echo already
      // re-added (deleted_at cleared on the server) is left alone.
      if (state.removed.length === 0) return state;
      const present = new Set(state.items.map((item) => item.id));
      const missing = state.removed.filter((item) => !present.has(item.id));
      return {
        ...state,
        items: missing.length > 0 ? [...state.items, ...missing] : state.items,
        removed: [],
        moveReceipt: null,
      };
    }
    case 'dismiss-undo':
      return state.removed.length === 0
        ? state
        : { ...state, removed: [], moveReceipt: null };
    case 'set-order':
      return { ...state, categoryOrder: action.order };
    case 'begin-load':
      // A pending undo belongs to the week we're leaving – drop it.
      return {
        ...state,
        loading: true,
        failed: false,
        listId: null,
        items: [],
        removed: [],
        moveReceipt: null,
      };
    case 'load-failed':
      // Stop pretending to load. `loading` stays true so nothing downstream
      // treats an empty list as a real empty week.
      return { ...state, failed: true };
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

async function fetchItems(listId: string): Promise<ItemRow[]> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select(
      'id, name, quantity, unit, aisle, is_checked, checked_by_initial, checked_by_user_id, checked_at, updated_at, deleted_at',
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
  /** A load failed outright – show the retry screen, not a spinner. */
  failed: boolean;
  live: LiveStatus;
  items: ShoppingItem[];
  categoryOrder: Category[];
  /** The signed-in member – done-section initials style "you" differently. */
  userId: string;
  /** Week navigation: every week has its own list (designed 2026-07-16). */
  viewedWeekStart: string;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  addItem: (name: string) => void;
  toggleItem: (id: string) => void;
  updateItem: (
    id: string,
    fields: { name: string; quantity: string | null; aisle: Category | null },
  ) => void;
  removeItem: (id: string) => void;
  /** The most recently deleted item, offered for undo; null once undone or dismissed. */
  /** What the last delete took: one item, the cleared done section, or a week move. */
  undoItems: ShoppingItem[];
  /** How those items left, for the toast's wording ("deleted"/"cleared"/"moved"). */
  undoVerb: string;
  /** Restore the last-deleted item (clears deleted_at). */
  undoRemove: () => void;
  /** Drop the undo offer without restoring (the toast timed out). */
  dismissUndo: () => void;
  /** Soft-deletes every checked item (the manual "Clear" in the done section). */
  clearCompleted: () => void;
  /**
   * True on a PAST week that still has unchecked items – the only place the
   * "Move all items to this week" button is drawn (Figma 434:7148).
   */
  canMoveToThisWeek: boolean;
  /** Send this past week's unchecked items to the current week's list. */
  moveItemsToThisWeek: () => void;
  fillFromWeeklyPlan: () => Promise<number>;
  setCategoryOrder: (order: Category[]) => void;
  /** Re-run the initial load after it failed at launch (the offline retry). */
  retry: () => void;
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
    failed: false,
    listId: null,
    items: [],
    memory: {},
    categoryOrder: [...CATEGORIES],
    removed: [],
    moveReceipt: null,
  });
  const [live, setLive] = useState<LiveStatus>('connecting');
  // Read back inside refresh(), which has to stay stable (the realtime effect
  // depends on it – putting `live` in its deps would rebuild the channel on
  // every status change).
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);
  // Bumped to re-run the boot effect after a launch-time load failure.
  const [bootAttempt, setBootAttempt] = useState(0);
  // Bumped to rebuild the realtime channel once a fetch proves the network is
  // back – see refresh().
  const [channelAttempt, setChannelAttempt] = useState(0);
  // Week navigation (designed 2026-07-16): every week has its own list.
  // Reachable weeks mirror the plan's rule – existing lists, weeks with a
  // plan, and the current week; two weeks back at most.
  // Live, not computed once at mount – see useCurrentWeekStart and known bug 3.
  const currentWeekStart = useCurrentWeekStart();
  // Callbacks and the boot effect read the week through this ref, so a week
  // boundary crossed mid-session cannot change their identity and re-run them.
  // The roll-over effect below keeps it in step and owns the reaction.
  const currentWeekRef = useRef(currentWeekStart);
  const [viewedWeekStart, setViewedWeekStart] = useState(currentWeekStart);
  const [weekOptions, setWeekOptions] = useState<string[]>([currentWeekStart]);
  const viewedWeekRef = useRef(viewedWeekStart);
  useEffect(() => {
    viewedWeekRef.current = viewedWeekStart;
  }, [viewedWeekStart]);

  const fetchWeekOptions = useCallback(async (): Promise<string[]> => {
    const currentWeek = currentWeekRef.current;
    const minWeek = addWeeksKey(currentWeek, -2);
    const [lists, plans] = await Promise.all([
      supabase
        .from('shopping_lists')
        .select('week_start_date')
        .eq('household_id', household.id)
        .is('deleted_at', null)
        .not('week_start_date', 'is', null)
        .gte('week_start_date', minWeek),
      supabase
        .from('meal_plans')
        .select('week_start_date')
        .eq('household_id', household.id)
        .is('deleted_at', null)
        .gte('week_start_date', minWeek),
    ]);
    if (lists.error) throw lists.error;
    if (plans.error) throw plans.error;
    const weeks = new Set<string>([currentWeek]);
    for (const row of lists.data ?? []) weeks.add(row.week_start_date);
    for (const row of plans.data ?? []) weeks.add(row.week_start_date);
    return [...weeks].sort();
  }, [household.id]);

  // Callbacks read the latest state through a ref so they can stay stable.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Refetch everything (items + household prefs) and merge over local state.
  // Used on reconnect and app foreground – it also picks up learned
  // categories and category order, which deliberately have no realtime.
  const refresh = useCallback(async () => {
    try {
      fetchWeekOptions().then(setWeekOptions, () => {});
      const listId = stateRef.current.listId;
      if (!listId) return;
      const [rows, prefs] = await Promise.all([fetchItems(listId), fetchPrefs(household.id)]);
      dispatch({
        type: 'refresh',
        rows,
        memory: prefs.memory,
        categoryOrder: sanitizeOrder(prefs.categoryOrder ?? stateRef.current.categoryOrder),
      });
      // The fetch just succeeded, so the network is back – but the socket
      // only notices its own death at the next heartbeat (25s), which left
      // "Offline" sitting over visibly fresh items (Thomas, 2026-07-25).
      // Rebuild the channel now: subscribing on a disconnected socket
      // reconnects it, so 'live' arrives in about a second instead of after
      // the heartbeat timeout plus backoff. The badge only goes as far as
      // 'connecting' here – reaching the server does not prove the stream is
      // flowing, and only SUBSCRIBED proves that.
      if (liveRef.current === 'offline') {
        setLive('connecting');
        setChannelAttempt((n) => n + 1);
      }
    } catch (error) {
      console.warn('[shopping] refresh failed', error);
    }
  }, [household.id, fetchWeekOptions]);

  // Re-run the initial load after it failed (a launch-time outage leaves the
  // tab with no listId, which every other path no-ops on). Back to
  // 'connecting' so the badge and the offline screen reflect the new attempt.
  const retry = useCallback(() => {
    setLive('connecting');
    setBootAttempt((n) => n + 1);
  }, []);

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

  // Boot: resolve the current week's list (creating it on first run), load
  // everything, and migrate legacy device prefs up.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // getOrCreateListId and fetchPrefs are independent – run them together
      // (migrateDevicePrefs still has to wait for serverPrefs).
      // The live week, read at the moment the boot runs rather than captured
      // when the effect was created: a "Try again" pressed after a week
      // boundary has to resolve the NEW week's list, not the one this provider
      // mounted on.
      const [listId, serverPrefs] = await Promise.all([
        getOrCreateListId(household.id, userId, currentWeekRef.current),
        fetchPrefs(household.id),
      ]);
      const prefs = await migrateDevicePrefs(household.id, serverPrefs);
      const [rows, weeks] = await Promise.all([fetchItems(listId), fetchWeekOptions()]);
      if (cancelled) return;
      setWeekOptions(weeks);
      dispatch({
        type: 'ready',
        listId,
        rows,
        memory: prefs.memory,
        categoryOrder: prefs.categoryOrder ?? [...CATEGORIES],
      });
    })().catch((error) => {
      console.warn('[shopping] initial load failed', error);
      if (!cancelled) {
        setLive('offline');
        dispatch({ type: 'load-failed' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [household.id, userId, fetchWeekOptions, bootAttempt]);

  // Switching weeks swaps the whole list: resolve that week's list row and
  // load its items. The realtime channel follows listId automatically.
  const viewWeek = useCallback(
    (weekStart: string) => {
      setViewedWeekStart(weekStart);
      dispatch({ type: 'begin-load' });
      (async () => {
        const listId = await getOrCreateListId(household.id, userId, weekStart);
        const rows = await fetchItems(listId);
        if (viewedWeekRef.current !== weekStart) return; // navigated on
        dispatch({
          type: 'ready',
          listId,
          rows,
          memory: stateRef.current.memory,
          categoryOrder: stateRef.current.categoryOrder,
        });
      })().catch((error) => {
        // Only the week still on screen gets the error – a failure for a week
        // the shopper has already navigated away from is not theirs to see.
        console.warn('[shopping] week load failed', error);
        if (viewedWeekRef.current === weekStart) {
          dispatch({ type: 'load-failed' });
        }
      });
    },
    [household.id, userId],
  );

  // A week boundary crossed while this provider was alive (known bug 3). The
  // ref is synced FIRST so anything reading it afterwards – fetchWeekOptions,
  // a retry's boot – already sees the new week.
  // Who follows the roll-over: a shopper looking at what used to be "this
  // week" is moved onto the new one, because that is the list they think they
  // have open. A shopper who had deliberately navigated back to an older week
  // is left exactly where they are; the week simply stops being current, and
  // "Move all items to this week" appears for it like any other past week.
  // viewWeek is safe to use here, unlike on the plan side, because it resolves
  // the week's list against the SERVER (getOrCreateListId) rather than looking
  // it up in state we might not have refetched yet.
  useEffect(() => {
    const previous = currentWeekRef.current;
    currentWeekRef.current = currentWeekStart;
    if (previous === currentWeekStart) return;
    fetchWeekOptions().then(setWeekOptions, () => {});
    if (viewedWeekRef.current === previous) viewWeek(currentWeekStart);
  }, [currentWeekStart, fetchWeekOptions, viewWeek]);

  // Realtime: stream the other phones' item changes into local state. The
  // subscribe status doubles as the Live badge; a RE-subscribe (reconnect)
  // refetches to cover anything missed while disconnected – the first subscribe
  // skips it, since the boot (or viewWeek) already loaded this list. A bump of
  // channelAttempt rebuilds the channel from scratch and skips the refetch for
  // the same reason: the refresh that triggered it has just run.
  useEffect(() => {
    const listId = state.listId;
    if (!listId) return;
    let subscribedBefore = false;
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
          if (subscribedBefore) refresh();
          subscribedBefore = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setLive('offline');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.listId, refresh, channelAttempt]);

  // Coming back to the foreground refetches: realtime reconnects on its own,
  // but events missed while backgrounded would otherwise leave stale state.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState !== 'active') return;
      // Boot never finished (launch-time outage) leaves listId null, which
      // refresh() no-ops on – re-run the boot instead so the tab recovers.
      if (stateRef.current.listId == null) retry();
      else refresh();
    });
    return () => subscription.remove();
  }, [refresh, retry]);

  // Returning to the Shopping tab refetches. Plan edits made on the Plan tab
  // (adding or removing a meal) reconcile the week's list server-side and
  // reach us through the realtime channel – but if that event is ever missed
  // (a dropped socket, a backgrounded tab), tab focus is the guaranteed
  // catch-up: the list always reconciles with server truth on the way in.
  // No-ops before boot resolves the listId (Thomas, 2026-07-30).
  useFocusEffect(
    useCallback(() => {
      if (stateRef.current.listId != null) refresh();
    }, [refresh]),
  );

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
      dispatch({ type: 'toggle', id, now, initial, userId });
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
          // edited_manually is the A+rails guard: a line the family touched
          // by hand is never overwritten by the plan reconciler again.
          .update({ name, quantity, unit, aisle: fields.aisle, edited_manually: true })
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
      // The reducer snapshots the row as it drops it, so the undo toast can
      // never miss an item that is on screen but not yet mirrored into a ref.
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

  const undoRemove = useCallback(() => {
    const ids = stateRef.current.removed.map((item) => item.id);
    if (ids.length === 0) return;
    // A week move went two places at once (out of this week, into the current
    // one, possibly merged into a line already there), so clearing deleted_at
    // would only undo half of it. The server reverses both halves from its
    // receipt; the refresh then shows whichever week is on screen as it now
    // truly is.
    const receipt = stateRef.current.moveReceipt;
    if (receipt) {
      dispatch({ type: 'restore' });
      undoMoveWeekLeftovers(receipt).then(refresh, (error) => {
        console.warn('[shopping] undo move failed', error);
        refresh();
      });
      return;
    }
    dispatch({ type: 'restore' });
    // Clearing deleted_at revives the rows; the set_updated_at trigger bumps
    // updated_at, so the realtime echo re-adds them on the other phones too.
    // One statement whether it is a single swipe-delete or a whole cleared
    // done section.
    guard(
      'restore',
      supabase.from('shopping_list_items').update({ deleted_at: null }).in('id', ids),
    );
  }, [guard, refresh]);

  const dismissUndo = useCallback(() => dispatch({ type: 'dismiss-undo' }), []);

  // Shared by the Clear button and fill-from-plan: checked items leave the
  // list together, as one soft-delete on the server.
  const clearCompleted = useCallback(() => {
    const listId = stateRef.current.listId;
    if (!listId) return;
    const ids = stateRef.current.items.filter((item) => item.isChecked).map((item) => item.id);
    if (ids.length === 0) return;
    // One action, so the reducer can snapshot the whole batch for undo.
    dispatch({ type: 'clear-completed' });
    // Delete exactly the rows we just took off screen, by id: a blanket
    // "every checked row in this list" could also sweep away something the
    // other phone ticked a second ago, which undo would then not bring back.
    guard(
      'clear completed',
      supabase
        .from('shopping_list_items')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids),
    );
  }, [guard]);

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

  // "Move all items to this week" (Figma 434:7148, built 2026-08-03). Only
  // ever reachable from a past week. The items go the instant it is pressed –
  // the undo toast, not a confirmation dialog, is what makes that safe – but
  // the toast itself waits for the server, because until the move has actually
  // happened there is nothing to take back. A failure puts everything back by
  // refetching, and offers no undo.
  const moveItemsToThisWeek = useCallback(() => {
    const listId = stateRef.current.listId;
    const week = viewedWeekRef.current;
    if (!listId || week >= currentWeekStart) return;
    const moving = stateRef.current.items.filter((item) => !item.isChecked);
    if (moving.length === 0) return;
    dispatch({ type: 'move-out', ids: moving.map((item) => item.id) });
    moveWeekLeftovers(listId, currentWeekStart).then(
      (receipt) => {
        // Whatever the server actually moved is the truth – another phone may
        // have ticked one off a second earlier, and the old week has to settle
        // back onto exactly what is left.
        refresh();
        if (receipt.moved === 0) return;
        // Navigated on: the move stands, but an undo toast belongs to the week
        // it happened on, not the one now on screen.
        if (viewedWeekRef.current !== week) return;
        dispatch({ type: 'moved', items: moving, receipt });
      },
      (error) => {
        console.warn('[shopping] move to this week failed', error);
        refresh();
      },
    );
  }, [currentWeekStart, refresh]);

  const fillFromWeeklyPlan = useCallback(async (): Promise<number> => {
    const listId = stateRef.current.listId;
    if (!listId) return 0;
    // A new week starts clean: last week's checked-off items leave the list
    // when the plan fills it (decided 2026-07-07, together with the manual
    // Clear button).
    clearCompleted();
    // The real thing since 2026-07-16: sweep the VIEWED week's plan into
    // its list (idempotent – already-contributed meals are skipped).
    const { data, error } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('household_id', household.id)
      .eq('week_start_date', viewedWeekRef.current)
      .is('deleted_at', null)
      .limit(1);
    if (error) {
      console.warn('[shopping] fill from plan failed', error);
      return 0;
    }
    const planId = data?.[0]?.id;
    if (!planId) return 0;
    try {
      const touched = await pushPlanToList(planId);
      await refresh();
      return touched;
    } catch (pushError) {
      console.warn('[shopping] fill from plan failed', pushError);
      refresh();
      return 0;
    }
  }, [household.id, clearCompleted, refresh]);

  // The move button belongs to a past week that still has something on it –
  // a week whose items were all bought has nothing to move, and the current
  // week has nowhere to move them to (Thomas, 2026-08-03).
  const canMoveToThisWeek =
    viewedWeekStart < currentWeekStart && state.items.some((item) => !item.isChecked);

  // One item keeps its name ("Milk deleted"); a batch is counted. The verb
  // says which of the three ways it left.
  const undoVerb = state.moveReceipt
    ? 'moved'
    : state.removed.length === 1
      ? 'deleted'
      : 'cleared';

  // Week navigation derived state: chevrons disable at the edges.
  const viewedIndex = weekOptions.indexOf(viewedWeekStart);
  const canGoBack = viewedIndex > 0;
  const canGoForward = viewedIndex >= 0 && viewedIndex < weekOptions.length - 1;
  const goBack = useCallback(() => {
    const index = weekOptions.indexOf(viewedWeekRef.current);
    if (index > 0) viewWeek(weekOptions[index - 1]);
  }, [weekOptions, viewWeek]);
  const goForward = useCallback(() => {
    const index = weekOptions.indexOf(viewedWeekRef.current);
    if (index >= 0 && index < weekOptions.length - 1) viewWeek(weekOptions[index + 1]);
  }, [weekOptions, viewWeek]);

  // Retry whatever actually failed. A failed launch re-runs the boot load
  // (which also rebuilds the week options); a failed week SWITCH reloads that
  // week, so the retry button doesn't silently drop the shopper back onto the
  // current week (audit 2026-08-02, finding 5).
  const retryLoad = useCallback(() => {
    if (viewedWeekRef.current === currentWeekStart) {
      // 'begin-load' clears `failed` so the retry shows a spinner instead of
      // leaving the error block on screen while it works – pressing "Try
      // again" otherwise looked like it did nothing at all (Thomas, on device
      // 2026-08-03). viewWeek below already dispatches it.
      dispatch({ type: 'begin-load' });
      retry();
    } else {
      viewWeek(viewedWeekRef.current);
    }
  }, [currentWeekStart, retry, viewWeek]);

  const api = useMemo(
    () => ({
      loading: state.loading,
      failed: state.failed,
      live,
      items: state.items,
      categoryOrder: state.categoryOrder,
      userId,
      viewedWeekStart,
      canGoBack,
      canGoForward,
      goBack,
      goForward,
      addItem,
      toggleItem,
      updateItem,
      removeItem,
      undoItems: state.removed,
      undoVerb,
      undoRemove,
      dismissUndo,
      clearCompleted,
      canMoveToThisWeek,
      moveItemsToThisWeek,
      fillFromWeeklyPlan,
      setCategoryOrder,
      retry: retryLoad,
    }),
    [
      state.loading,
      state.failed,
      live,
      state.items,
      state.categoryOrder,
      userId,
      viewedWeekStart,
      canGoBack,
      canGoForward,
      goBack,
      goForward,
      addItem,
      toggleItem,
      updateItem,
      removeItem,
      state.removed,
      undoVerb,
      undoRemove,
      dismissUndo,
      clearCompleted,
      canMoveToThisWeek,
      moveItemsToThisWeek,
      fillFromWeeklyPlan,
      setCategoryOrder,
      retryLoad,
    ],
  );

  return <ShoppingListContext.Provider value={api}>{children}</ShoppingListContext.Provider>;
}

export function useShoppingList(): ShoppingListApi {
  const ctx = useContext(ShoppingListContext);
  if (!ctx) throw new Error('useShoppingList must be used inside ShoppingListProvider');
  return ctx;
}
