import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, tabBarClearance } from '@/constants/theme';

/**
 * "Move all items to this week" – the action on a past week's list (Figma
 * 434:7148 "transfer items from last week", designed 2026-08-03).
 *
 * Only rendered on a PAST week that still has unchecked items: the current
 * week has nowhere to push to, and a week that was fully bought has nothing
 * to push.
 *
 * PINNED above the tab bar rather than ending the scrolling content (Thomas,
 * 2026-08-03). The frame shows a short week, where the button sits at the
 * bottom of the list area either way – but a week with twenty leftovers would
 * have hidden it below the fold, which is the same trap the recipe Save
 * button fell into on a long recipe (2026-07-28). This is that same footer:
 * a top border and the screen's own background, so rows scroll under it
 * instead of showing through.
 *
 * Pressed is the DS's `button/solid/fill/pressed` – React Native inherits no
 * press feedback of its own, and states live on the DS component rather than
 * on each frame that uses it.
 */
export function MoveWeekButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingBottom: tabBarClearance(insets, Spacing.three) }}
      className="w-full border-t border-border-subtle bg-surface-neutral-lightest px-layout-small pt-comp-medium">
      <Pressable accessibilityRole="button" onPress={onPress}>
        {({ pressed }) => (
          <View
            className={`w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium px-comp-xlarge py-comp-large ${
              pressed ? 'bg-button-solid-fill-pressed' : 'bg-button-solid-fill-enabled'
            }`}>
            <Text
              className={`font-paragraph text-paragraph font-default leading-xsmall ${
                pressed ? 'text-button-solid-label-pressed' : 'text-button-solid-label-enabled'
              }`}>
              Move all items to this week
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}
