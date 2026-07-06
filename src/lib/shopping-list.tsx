// Local shopping-list store. Shapes mirror the Supabase rows
// (shopping_list_items, item_category_memory) so swapping this for the real
// client later is a data-source change, not a redesign. Realtime sync and
// auth arrive with the sign-in flow; until then the store is in-memory.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

// v1 category set (projektgrundlag decision #7): fixed constants in app code.
// Order here is the default display order until per-household reordering
// lands (the drag handle in the design).
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
  // Quantity is a single display string for now ("250g", "2 pcs"). When this
  // wires to Supabase it splits into numeric quantity + unit text.
  quantity: string | null;
  aisle: Category;
  isChecked: boolean;
  checkedByInitial: string | null;
  checkedAt: number | null;
  // UI-only: a checked item lingers in its category group until it settles
  // into the done section (forgiving of accidental taps).
  settled: boolean;
}

// TODO(auth): the signed-in household member's initial.
const CURRENT_USER_INITIAL = 'T';

// How long a freshly checked item stays in its category group before moving
// down to the done section (design decision: forgiving of accidental taps).
export const LINGER_MS = 1500;

export function normalizeItemName(name: string): string {
  // Same rule as ingredient merging: trimmed, lowercased. Also collapse
  // whitespace (incl. non-breaking spaces) so near-identical entries match.
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

interface State {
  items: ShoppingItem[];
  // The household's learned name -> category mapping (item_category_memory).
  memory: Record<string, Category>;
  // Display order of category groups – each household arranges these to
  // match their walk through the store. Moves to the household row in
  // Supabase when the sign-in flow lands.
  categoryOrder: Category[];
}

type Action =
  | { type: 'add'; name: string; id: string }
  | { type: 'toggle'; id: string; now: number }
  | { type: 'settle'; id: string }
  | {
      type: 'update';
      id: string;
      name: string;
      quantity: string | null;
      aisle: Category;
    }
  | { type: 'remove'; id: string }
  | { type: 'fill-sample'; items: ShoppingItem[] }
  | { type: 'set-order'; order: Category[] }
  | { type: 'hydrate'; memory: Record<string, Category>; categoryOrder: Category[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const name = action.name.replace(/\s+/g, ' ').trim();
      if (!name) return state;
      const aisle = state.memory[normalizeItemName(name)] ?? 'Other';
      const item: ShoppingItem = {
        id: action.id,
        name,
        quantity: null,
        aisle,
        isChecked: false,
        checkedByInitial: null,
        checkedAt: null,
        settled: false,
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
                  checkedByInitial: CURRENT_USER_INITIAL,
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
        action.aisle === prev.aisle
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
    case 'fill-sample':
      return { ...state, items: [...state.items, ...action.items] };
    case 'set-order':
      return { ...state, categoryOrder: action.order };
    case 'hydrate':
      return { ...state, memory: action.memory, categoryOrder: action.categoryOrder };
  }
}

const STORAGE_KEY = 'prepeat.shopping.household-prefs.v1';

function sanitizeOrder(order: unknown): Category[] {
  const valid = Array.isArray(order)
    ? (order.filter((c) => (CATEGORIES as readonly string[]).includes(c)) as Category[])
    : [];
  // Categories added in app updates fall back to the end of the list.
  return [...valid, ...CATEGORIES.filter((c) => !valid.includes(c))];
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

interface ShoppingListApi {
  items: ShoppingItem[];
  categoryOrder: Category[];
  addItem: (name: string) => void;
  toggleItem: (id: string) => void;
  updateItem: (id: string, fields: { name: string; quantity: string | null; aisle: Category }) => void;
  removeItem: (id: string) => void;
  fillFromWeeklyPlan: () => void;
  setCategoryOrder: (order: Category[]) => void;
}

const ShoppingListContext = createContext<ShoppingListApi | null>(null);

export function ShoppingListProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    memory: {},
    categoryOrder: [...CATEGORIES],
  });
  const idCounter = useRef(0);
  const hydrated = useRef(false);

  // Household preferences (learned categories + store-walk order) survive
  // app restarts via device storage until they live in Supabase.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          dispatch({
            type: 'hydrate',
            memory: parsed.memory ?? {},
            categoryOrder: sanitizeOrder(parsed.categoryOrder),
          });
        }
      })
      .catch(() => {
        // Unreadable prefs are not worth crashing over; start fresh.
      })
      .finally(() => {
        hydrated.current = true;
      });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ memory: state.memory, categoryOrder: state.categoryOrder }),
    ).catch(() => {});
  }, [state.memory, state.categoryOrder]);

  const nextId = useCallback(() => {
    idCounter.current += 1;
    return `local-${idCounter.current}`;
  }, []);

  const addItem = useCallback(
    (name: string) => dispatch({ type: 'add', name, id: nextId() }),
    [nextId],
  );

  const toggleItem = useCallback((id: string) => {
    dispatch({ type: 'toggle', id, now: Date.now() });
    // After the linger window the item settles into the done section (the
    // settle action is a no-op if it was unchecked again in the meantime).
    setTimeout(() => dispatch({ type: 'settle', id }), LINGER_MS);
  }, []);

  const updateItem = useCallback(
    (id: string, fields: { name: string; quantity: string | null; aisle: Category }) =>
      dispatch({ type: 'update', id, ...fields }),
    [],
  );

  const removeItem = useCallback((id: string) => dispatch({ type: 'remove', id }), []);

  const setCategoryOrder = useCallback(
    (order: Category[]) => dispatch({ type: 'set-order', order: sanitizeOrder(order) }),
    [],
  );

  const fillFromWeeklyPlan = useCallback(() => {
    dispatch({
      type: 'fill-sample',
      items: SAMPLE_BASKET.map(([name, quantity, aisle]) => ({
        id: nextId(),
        name,
        quantity,
        aisle,
        isChecked: false,
        checkedByInitial: null,
        checkedAt: null,
        settled: false,
      })),
    });
  }, [nextId]);

  const api = useMemo(
    () => ({
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
