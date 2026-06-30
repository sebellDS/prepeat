import {
  Montserrat_200ExtraLight,
  Montserrat_400Regular,
  Montserrat_700Bold,
  useFonts,
} from '@expo-google-fonts/montserrat';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // The DS theme maps `font-header` / `font-paragraph` to the "Montserrat"
  // family and `font-emphasized` / `font-default` / `font-understate` to
  // weights 700 / 400 / 200. Load those three weights so the family resolves
  // on native.
  const [fontsLoaded] = useFonts({
    Montserrat_200ExtraLight,
    Montserrat_400Regular,
    Montserrat_700Bold,
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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
