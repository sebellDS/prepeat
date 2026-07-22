// The signed-in user's households, provided to everything behind the
// onboarding gate. RootGate resolves membership before rendering the tabs,
// so inside the app there is always an active household. `useHousehold`
// keeps its original signature (returns the active household) so every
// existing consumer is untouched; the switcher uses `useHouseholdSwitcher`.
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { Household } from '@/lib/household';

interface HouseholdContextValue {
  /** The household the app is currently showing. */
  household: Household;
  /** Every household the user belongs to (oldest first). */
  households: Household[];
  /** Switch the active household by id (persisted across launches). */
  setActiveHousehold: (id: string) => void;
  /** Add a just-joined household to the list and make it active. */
  addHousehold: (household: Household) => void;
  /** Reflect an edit (rename/image) back into the list without a refetch. */
  applyHouseholdUpdate: (household: Household) => void;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({
  household,
  households,
  setActiveHousehold,
  addHousehold,
  applyHouseholdUpdate,
  children,
}: {
  household: Household;
  households: Household[];
  setActiveHousehold: (id: string) => void;
  addHousehold: (household: Household) => void;
  applyHouseholdUpdate: (household: Household) => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ household, households, setActiveHousehold, addHousehold, applyHouseholdUpdate }),
    [household, households, setActiveHousehold, addHousehold, applyHouseholdUpdate],
  );
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

/** The active household. Unchanged signature – all existing consumers keep working. */
export function useHousehold(): Household {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used inside HouseholdProvider');
  return ctx.household;
}

/** The active household plus the full list and the switch/add controls. */
export function useHouseholdSwitcher(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHouseholdSwitcher must be used inside HouseholdProvider');
  return ctx;
}
