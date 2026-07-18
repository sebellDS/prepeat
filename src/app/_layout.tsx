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
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { AuthProvider, useAuth } from '@/lib/auth';
import { fetchMyHousehold, type Household } from '@/lib/household';
import { HouseholdProvider } from '@/lib/household-context';

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
          <AnimatedSplashOverlay />
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
  | { userId: string; status: 'ready'; household: Household | null }
  | { userId: string; status: 'error' };

function RootGate() {
  const { session, firstName } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  // Bumping this re-runs the fetch – the retry screen's "Try again".
  const [reloadKey, setReloadKey] = useState(0);

  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (userId == null) return;
    let cancelled = false;
    fetchMyHousehold()
      .then((result) => {
        if (!cancelled) setMembership({ userId, status: 'ready', household: result });
      })
      .catch(() => {
        if (!cancelled) setMembership({ userId, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  // Still restoring the stored session at launch: stay behind the splash.
  if (session === undefined) {
    return null;
  }

  const markHouseholdReady = (ready: Household) => {
    if (userId != null) {
      setMembership({ userId, status: 'ready', household: ready });
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

  if (current.household == null) {
    return (
      <OnboardingFlow
        session={session}
        firstName={firstName}
        onHouseholdReady={markHouseholdReady}
      />
    );
  }

  return (
    <HouseholdProvider household={current.household}>
      <AppTabs />
    </HouseholdProvider>
  );
}

/**
 * Shown when the household lookup fails at launch (no connection, server
 * blip). Improvised – there is no Figma design for this offline state yet
 * (flagged in the backlog). It deliberately reassures that nothing is lost,
 * since the bug it replaces made an existing household look gone.
 */
function HouseholdLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-neutral-lightest">
      <View className="flex-1 items-center justify-center gap-layout-medium px-layout-large">
        <View className="w-full items-center gap-comp-small">
          <Text className="text-center font-header text-display-5 font-emphasized leading-medium text-text-default">
            Can&apos;t reach your kitchen
          </Text>
          <Text className="text-center font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
            We couldn&apos;t load your household. Check your connection and try
            again – your recipes and lists are safe.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="w-full items-center rounded-medium bg-button-solid-fill-enabled px-comp-xlarge py-comp-large">
          <Text className="font-paragraph text-paragraph font-default leading-xsmall text-button-solid-label-enabled">
            Try again
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
