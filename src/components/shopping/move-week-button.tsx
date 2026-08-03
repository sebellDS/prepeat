import { Pressable, Text, View } from 'react-native';

/**
 * "Move all items to this week" – the end of a past week's list (Figma
 * 434:7148 "transfer items from last week", designed 2026-08-03).
 *
 * Only drawn on a PAST week that still has unchecked items on it: the current
 * week has nowhere to push to, and a week that was fully bought has nothing
 * to push. The full-width solid button sits below the last category group,
 * pushed to the bottom of the list area when the list is short (the frame's
 * auto-layout ends in justify-end) and simply following the last row when it
 * is long.
 *
 * Pressed is the DS's own button/solid/fill/pressed – the frames show only
 * the default state, but React Native inherits no press feedback of its own
 * and the DS defines the token (CLAUDE.md: interactive states are built, not
 * inherited).
 */
export function MoveWeekButton({ onPress }: { onPress: () => void }) {
  return (
    <View className="mt-auto w-full px-layout-small">
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
