import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MaterialIcons } from "@expo/vector-icons";

import { ds } from "@/constants/ds";

/**
 * Leave confirmation (Figma "leave household", 2026-07-22). Carries the
 * copy-on-leave promise so the irreversible-but-rejoinable nature is clear
 * (docs/leave-household.md). The actual leave runs in onConfirm.
 */
export function LeaveHouseholdSheet({
  visible,
  householdName,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  householdName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <BottomSheet visible={visible} title="Leave household" onClose={onClose}>
      {visible && (
        <Content householdName={householdName} onClose={onClose} onConfirm={onConfirm} />
      )}
    </BottomSheet>
  );
}

function Content({
  householdName,
  onClose,
  onConfirm,
}: {
  householdName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      // On success the tabs remount into the new kitchen and this sheet
      // unmounts – nothing more to do here.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong – please try again");
      setBusy(false);
    }
  };

  return (
    <View className="w-full gap-layout-small">
      <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
        {`You're about to leave "${householdName}". You'll keep your own copy of the recipes, and you can be invited back later.`}
      </Text>

      {error != null && (
        <View className="w-full flex-row items-start gap-comp-large rounded-medium bg-error-lightest px-comp-large py-comp-small">
          <Text className="flex-1 font-paragraph text-paragraph font-default leading-xsmall text-text-default">
            {error}
          </Text>
          <MaterialIcons name="error-outline" size={24} color={ds.colors.icon.default} />
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={leave}
        className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium bg-button-danger-fill-enabled py-comp-large"
      >
        {busy ? (
          <ActivityIndicator color={ds.colors.error['contrast-text']} />
        ) : (
          <>
            <MaterialIcons
              name="logout"
              size={24}
              color={ds.colors.error['contrast-text']}
            />
            <Text className="font-paragraph text-components-button-label font-default text-button-danger-label-enabled">
              Leave household
            </Text>
          </>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onClose}
        className="w-full items-center rounded-medium border-2 border-button-outline-border-enabled py-comp-large"
      >
        <Text className="font-paragraph text-components-button-label font-default text-button-outline-label-enabled">
          Cancel
        </Text>
      </Pressable>
    </View>
  );
}
