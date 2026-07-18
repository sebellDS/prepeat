import { Stack } from 'expo-router';

// The Plan tab is a stack (2026-07-18): plan → recipe detail (→ edit), so
// the back arrow returns to the plan the user came from instead of the
// Recipes tab's list. The (plan) group keeps the plan at the "/" index
// route. The detail/edit screens are the Recipes tab's own, re-exported.
export default function PlanLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
