// The signed-in user's household, provided to everything behind the
// onboarding gate. RootGate resolves membership before rendering the tabs,
// so inside the app the household always exists.
import { createContext, useContext, type ReactNode } from 'react';

import type { Household } from '@/lib/household';

const HouseholdContext = createContext<Household | null>(null);

export function HouseholdProvider({
  household,
  children,
}: {
  household: Household;
  children: ReactNode;
}) {
  return <HouseholdContext.Provider value={household}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): Household {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used inside HouseholdProvider');
  return ctx;
}
