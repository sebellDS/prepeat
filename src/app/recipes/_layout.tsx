import { Stack } from 'expo-router';

// The Recipes tab is a stack: list → detail → add/edit form. Screens draw
// their own headers (back arrow + actions per the Figma frames).
export default function RecipesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
