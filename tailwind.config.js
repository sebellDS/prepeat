/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    // Extend with Figma design tokens (colors, typography, spacing) as the
    // design system takes shape – avoid hardcoding values in components.
    extend: {},
  },
  plugins: [],
};
