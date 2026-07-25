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

export const MaxContentWidth = 800;

/**
 * Distance from the screen bottom that keeps content clear of the tab bar,
 * plus an optional gap on top (pass a `Spacing` value).
 *
 * `insets.bottom` is ALL that is needed: the tab bar is a native iOS one
 * (expo-router NativeTabs), and a native tab bar contributes its own height to
 * the safe-area inset of the screens inside it. There used to be a
 * `BottomTabInset` (50) added here as well, which double-counted the bar and
 * left ~50pt of dead space at the bottom of every scroll screen.
 *
 * Measured on device to settle it (Thomas, 2026-07-25 – his px are 1.5× points):
 *   insets.bottom + 54pt → 82px gap   (54.7pt)
 *   insets.bottom + 74pt → 112px gap  (74.7pt)
 *   insets.bottom + 16pt → 24px gap   (16pt)
 * In each case the visible gap equals exactly what is added ON TOP of
 * insets.bottom, so insets.bottom is the tab bar's top edge. `extra` is
 * therefore a real gap in points, not a fudge factor.
 *
 * Untested on a phone with no home indicator (insets.bottom 0), which has a
 * different tab bar again.
 */
export function tabBarClearance(insets: { bottom: number }, extra = 0): number {
  return insets.bottom + extra;
}
