import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { ds } from "@/constants/ds";

/**
 * "We couldn't load this – try again", the shared failure block (Figma
 * 392:11911 "error", designed 2026-07-27). One component for all three places
 * that can fail to load: the launch-time household lookup, the shopping list
 * and the weekly plan. Thomas's call that the copy changes per screen while
 * the block does not – so title and message are props and the layout is
 * fixed.
 *
 * The frame fills its screen's body and centres the block vertically, with
 * the text left-aligned at 40px margins: a wifi_off icon, the title in
 * text/accent at display-5, the message in text/default, then a 24px gap to
 * a full-width "Try again". Hosts give it the room – it fills what it is
 * handed (flex-1) rather than sizing itself.
 *
 * Replaces the two hand-rolled versions (HouseholdLoadError in _layout.tsx
 * and LoadFailed in shopping.tsx) improvised in July and blessed as-is on
 * 2026-07-25. Both were centred and narrower; this is the designed one.
 *
 * The copy keeps the app's en-dash over the frame's hyphen (writing style,
 * CLAUDE.md) – the only place this departs from the drawn text.
 */
export function LoadError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="w-full flex-1 items-start justify-center gap-layout-medium px-layout-large">
      <View className="w-full items-start gap-layout-small">
        {/* The designed glyph is Material Symbols wifi_off – the same icon the
            Live badge already uses for "offline" (live-badge.tsx). */}
        <MaterialIcons name="wifi-off" size={40} color={ds.colors.icon.brand} />
        <Text className="w-full font-header text-display-5 font-emphasized leading-small text-text-accent">
          {title}
        </Text>
        <Text className="w-full font-paragraph text-paragraph font-default leading-xsmall text-text-default">
          {message}
        </Text>
      </View>
      <View className="w-full items-start">
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium bg-button-solid-fill-enabled px-comp-xlarge py-comp-large"
        >
          <Text className="font-paragraph text-paragraph font-default leading-xsmall text-button-solid-label-enabled">
            Try again
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
