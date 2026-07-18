import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ds } from "@/constants/ds";

/**
 * Swipe action "remove" (Figma "Remove meal from plan" 147:28284): confirm
 * before the meal leaves the plan. If the week is on the shopping list, its
 * clean share is pulled back out (A + rails).
 */
export function RemoveMealSheet({
  visible,
  onClose,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  onRemove: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      title="Remove meal from plan"
      onClose={onClose}
    >
      <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
        You are about to remove a meal from your weekly plan. This action
        cannot be undone, but you can just add it again.
      </Text>
      {/* 16 between the buttons (Thomas, 2026-07-18 – was 8). */}
      <View className="w-full gap-layout-small">
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="w-full items-center rounded-medium border border-button-outline-border-enabled py-comp-large"
        >
          <Text className="font-paragraph text-components-button-label font-default text-text-subtle">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onRemove();
            onClose();
          }}
          className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium bg-error-main py-comp-large"
        >
          <MaterialIcons
            name="delete"
            size={20}
            color={ds.colors.error["contrast-text"]}
          />
          <Text className="font-paragraph text-components-button-label font-default text-error-contrast-text">
            Remove meal
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
