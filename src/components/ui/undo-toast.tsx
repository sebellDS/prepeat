import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

// IMPROVISED – no Figma design for a toast/snackbar yet (flagged in the
// backlog). Built from DS tokens (dark secondary surface + brand-lime action)
// so it reads as intentional, but the final look is Thomas's to design. Shown
// after a swipe-delete so the removed thing can be brought straight back.

/** How long the undo offer stays up before it fades away. */
export const UNDO_TIMEOUT_MS = 5000;

export function UndoToast({
  name,
  verb = 'deleted',
  onUndo,
  onDismiss,
  bottomInset,
}: {
  /** What was removed – shown before the verb and truncated if long. */
  name: string;
  /** Past-tense verb after the name ("deleted", "removed"). */
  verb?: string;
  onUndo: () => void;
  onDismiss: () => void;
  /** Distance from the screen bottom, so the pill clears the tab bar. */
  bottomInset: number;
}) {
  // The screen remounts this (keyed on the removed item) for each delete, so a
  // fresh timer starts every time – a new delete resets the countdown.
  useEffect(() => {
    const timer = setTimeout(onDismiss, UNDO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: bottomInset }}>
      <View className="w-full flex-row items-center justify-between gap-comp-large rounded-large bg-surface-secondary-darkest px-layout-small py-comp-large">
        {/* The name shrinks and truncates; the verb stays whole beside it. */}
        <View className="min-w-0 flex-1 flex-row items-center">
          <Text
            numberOfLines={1}
            className="shrink font-paragraph text-paragraph font-default leading-xsmall text-text-inverse">
            {name}
          </Text>
          <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-inverse">
            {` ${verb}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo"
          onPress={onUndo}
          hitSlop={12}>
          <Text className="font-paragraph text-paragraph font-emphasized leading-xsmall text-surface-primary-light">
            Undo
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
