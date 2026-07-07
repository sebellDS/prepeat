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
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { AuthProvider, useAuth } from '@/lib/auth';
import { fetchMyHousehold, type Household } from '@/lib/household';

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
function RootGate() {
  const { session, firstName } = useAuth();
  // Membership result tagged with the user it belongs to, so a sign-out or
  // account switch naturally invalidates it without an extra reset.
  const [membership, setMembership] = useState<{
    userId: string;
    household: Household | null;
  } | null>(null);

  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (userId == null) return;
    let cancelled = false;
    fetchMyHousehold()
      .then((result) => {
        if (!cancelled) setMembership({ userId, household: result });
      })
      .catch(() => {
        if (!cancelled) setMembership({ userId, household: null });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // undefined = membership not checked yet for this user.
  const household = membership?.userId === userId ? membership.household : undefined;

  // Still restoring the stored session at launch: stay behind the splash.
  if (session === undefined) {
    return null;
  }

  const markHouseholdReady = (ready: Household) => {
    if (userId != null) {
      setMembership({ userId, household: ready });
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

  if (household === undefined) {
    return null;
  }

  if (household == null) {
    return (
      <OnboardingFlow
        session={session}
        firstName={firstName}
        onHouseholdReady={markHouseholdReady}
      />
    );
  }

  return <AppTabs />;
}
