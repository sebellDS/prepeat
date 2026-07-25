/**
 * Imperative constants for the few React Native styling spots that aren't
 * expressed as NativeWind classes. Going forward, prefer DS utility classes
 * (bg-surface-primary, text-text-default, p-comp-small, font-header, …) in
 * components – see tailwind.config.js. The colors and fonts below are
 * re-pointed to the Sebell DS Prep+Eat tokens so nothing here is a generic
 * Expo-scaffold default.
 *
 * Light appearance only for v1; dark is deferred, so the dark map mirrors
 * light for now.
 */

import '@/global.css';

import { Platform } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ds = require('./ds-theme.cjs') as {
  colors: {
    text: { default: string; subtle: string };
    surface: { neutral: { white: string; lighter: string; light: string } };
  };
};

const light = {
  text: ds.colors.text.default,
  background: ds.colors.surface.neutral.white,
  backgroundElement: ds.colors.surface.neutral.lighter,
  backgroundSelected: ds.colors.surface.neutral.light,
  textSecondary: ds.colors.text.subtle,
} as const;

export const Colors = {
  light,
  // Dark mode is deferred for v1 – mirror light so consumers stay valid.
  dark: light,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// The DS family is Montserrat across the board; mono falls back to a system
// monospaced face since the DS has no mono token.
export const Fonts = {
  sans: 'Montserrat',
  serif: 'Montserrat',
  rounded: 'Montserrat',
  mono: Platform.select({ ios: 'ui-monospace', default: 'monospace' }),
} as const;

// Numeric scale for inline RN styles. Prefer DS spacing classes
// (gap-layout-*, p-comp-*) in new components.
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Clearance for scroll content to sit clear of the bottom tab bar: the
 * safe-area inset + the tab bar's own height, plus an optional per-screen tail
 * (pass a `Spacing` value). Centralised so the six scroll screens stop
 * hand-repeating `insets.bottom + BottomTabInset` – change the model here once.
 */
export function tabBarClearance(insets: { bottom: number }, extra = 0): number {
  return insets.bottom + BottomTabInset + extra;
}
