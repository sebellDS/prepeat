// Side-effect import FIRST: release builds lazy-load modules, and the
// NativeWind stylesheet must register before anything renders (leaving this
// to a leaf module like constants/theme.ts ships an unstyled app).
import '../global.css';

import {
  IBMPlexSans_400Regular,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  Montserrat_200ExtraLight,
  Montserrat_400Regular,
  Montserrat_700Bold,
  useFonts,
} from '@expo-google-fonts/montserrat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppTabs from '@/components/app-tabs';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { LoadError } from '@/components/ui/load-error';
import { AuthProvider, useAuth } from '@/lib/auth';
import { fetchMyHouseholds, type Household } from '@/lib/household';
import { HouseholdProvider } from '@/lib/household-context';

// The device-local pick of which household is showing. Device-local (not a
// DB column) matches the existing AsyncStorage patterns; a cross-device
// remembered selection can come later as a profiles column.
const ACTIVE_HOUSEHOLD_KEY = 'prepeat.active-household.v1';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // The DS maps `font-header` to Montserrat and `font-paragraph` to IBM Plex
  // Sans; `font-emphasized` / `font-default` / `font-understate` are weights
  // 700 / 400 / 200. Load the weights used so the families resolve on native.
  const [fontsLoaded] = useFonts({
    Montserrat_200ExtraLight,
    Montserrat_400Regular,
    Montserrat_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootGate />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Routes the app between onboarding and the main tabs:
 * no session → sign-in steps; session without a first name or household →
 * the remaining onboarding steps (which is also how a half-finished signup
 * resumes in the right place); otherwise the app itself.
 */
// Membership result tagged with the user it belongs to, so a sign-out or
// account switch naturally invalidates it without an extra reset. `error`
// (the fetch failed) is kept distinct from a loaded null household (genuinely
// not in one yet): the first must NOT drop an existing member into "create a
// household", which would let them make a duplicate and think their data is gone.
type Membership =
  | { userId: string; status: 'ready'; households: Household[] }
  | { userId: string; status: 'error' };

function RootGate() {
  const { session, firstName } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  // Which household is showing (id). Restored from AsyncStorage at load, then
  // driven by the switcher. Held separately from `membership` so switching
  // never needs a refetch.
  const [activeId, setActiveId] = useState<string | null>(null);
  // Bumping this re-runs the fetch – the retry screen's "Try again".
  const [reloadKey, setReloadKey] = useState(0);

  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (userId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const [households, storedId] = await Promise.all([
          fetchMyHouseholds(),
          AsyncStorage.getItem(ACTIVE_HOUSEHOLD_KEY),
        ]);
        if (cancelled) return;
        setMembership({ userId, status: 'ready', households });
        // Keep the remembered pick if it is still a membership, else oldest.
        setActiveId(households.find((h) => h.id === storedId)?.id ?? households[0]?.id ?? null);
      } catch {
        if (!cancelled) setMembership({ userId, status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const setActiveHousehold = useCallback((id: string) => {
    setActiveId(id);
    AsyncStorage.setItem(ACTIVE_HOUSEHOLD_KEY, id).catch(() => {});
  }, []);

  const addHousehold = useCallback((household: Household) => {
    setMembership((prev) =>
      prev && prev.status === 'ready'
        ? {
            ...prev,
            households: prev.households.some((h) => h.id === household.id)
              ? prev.households
              : [...prev.households, household],
          }
        : prev,
    );
    setActiveId(household.id);
    AsyncStorage.setItem(ACTIVE_HOUSEHOLD_KEY, household.id).catch(() => {});
  }, []);

  const applyHouseholdUpdate = useCallback((household: Household) => {
    setMembership((prev) =>
      prev && prev.status === 'ready'
        ? { ...prev, households: prev.households.map((h) => (h.id === household.id ? household : h)) }
        : prev,
    );
  }, []);

  const removeHousehold = useCallback((id: string) => {
    setMembership((prev) =>
      prev && prev.status === 'ready'
        ? { ...prev, households: prev.households.filter((h) => h.id !== id) }
        : prev,
    );
  }, []);

  // Still restoring the stored session at launch: stay behind the splash.
  if (session === undefined) {
    return null;
  }

  // Onboarding finishes with the user's first household – seed it as the only
  // membership and make it active.
  const markHouseholdReady = (ready: Household) => {
    if (userId != null) {
      setMembership({ userId, status: 'ready', households: [ready] });
      setActiveId(ready.id);
      AsyncStorage.setItem(ACTIVE_HOUSEHOLD_KEY, ready.id).catch(() => {});
    }
  };

  if (session == null || firstName == null) {
    return (
      <OnboardingFlow
        session={session}
        firstName={firstName}
        onHouseholdReady={markHouseholdReady}
      />
    );
  }

  // Only trust a result tagged for the current user (a stale one belongs to a
  // previous account); anything else means "still checking" – stay on splash.
  const current = membership?.userId === userId ? membership : null;
  if (current == null) {
    return null;
  }

  if (current.status === 'error') {
    return (
      <HouseholdLoadError
        onRetry={() => {
          setMembership(null);
          setReloadKey((key) => key + 1);
        }}
      />
    );
  }

  if (current.households.length === 0) {
    return (
      <OnboardingFlow
        session={session}
        firstName={firstName}
        onHouseholdReady={markHouseholdReady}
      />
    );
  }

  const activeHousehold =
    current.households.find((h) => h.id === activeId) ?? current.households[0];

  return (
    <HouseholdProvider
      household={activeHousehold}
      households={current.households}
      setActiveHousehold={setActiveHousehold}
      addHousehold={addHousehold}
      applyHouseholdUpdate={applyHouseholdUpdate}
      removeHousehold={removeHousehold}
    >
      {/* Remount the tabs on switch so the meal-plan / shopping providers
          start clean for the new household instead of showing the old one's
          data until their effects re-run. */}
      <AppTabs key={activeHousehold.id} />
    </HouseholdProvider>
  );
}

/**
 * Shown when the household lookup fails at launch (no connection, server
 * blip). The designed block (Figma 392:12013) sits at the top of the body,
 * which is where it lands here too – this screen has nothing else on it. It
 * deliberately reassures that nothing is lost, since the bug it replaces made
 * an existing household look gone.
 */
function HouseholdLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-neutral-lightest">
      <LoadError
        title="Can't reach your kitchen"
        message="We couldn't load your household. Check your connection and try again – your recipes and lists are safe."
        onRetry={onRetry}
      />
    </SafeAreaView>
  );
}
