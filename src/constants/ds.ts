// Typed access to the generated DS theme fragment for the rare cases where a
// component needs a raw value (native props like tintColor) instead of a
// Tailwind class. Classes remain the default way to consume tokens.
/* eslint-disable @typescript-eslint/no-require-imports */
interface ColorScale {
  lighter: string;
  light: string;
  main: string;
  dark: string;
  darker: string;
  DEFAULT: string;
}

interface DsTheme {
  colors: {
    surface: {
      primary: ColorScale;
      secondary: ColorScale;
      neutral: ColorScale & { white: string };
    };
    error: ColorScale & { 'contrast-text': string };
    warning: ColorScale & { 'contrast-text': string };
    success: ColorScale & { 'contrast-text': string };
    info: ColorScale & { 'contrast-text': string };
    text: {
      default: string;
      subtle: string;
      disabled: string;
      link: string;
      brand: string;
      accent: string;
      inverse: string;
      danger: string;
      success: string;
      warning: string;
      info: string;
      DEFAULT: string;
    };
    border: { default: string; DEFAULT: string };
    icon: { default: string; DEFAULT: string };
  };
}

export const ds: DsTheme = require('./ds-theme.cjs');
