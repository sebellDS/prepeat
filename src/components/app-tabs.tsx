import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { ds } from '@/constants/ds';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={ds.colors.surface.neutral.white}
      tintColor={ds.colors.surface.primary.main}
      labelStyle={{ selected: { color: ds.colors.surface.primary.main } }}>
      <NativeTabs.Trigger name="(plan)">
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="recipes">
        <NativeTabs.Trigger.Label>Recipes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shopping">
        <NativeTabs.Trigger.Label>Shopping</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bag', selected: 'bag.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="household">
        <NativeTabs.Trigger.Label>Household</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
      </NativeTabs.Trigger>

      {/* Token verification screen; reachable at /ds-check but not a tab. */}
      <NativeTabs.Trigger name="ds-check" hidden />
    </NativeTabs>
  );
}
