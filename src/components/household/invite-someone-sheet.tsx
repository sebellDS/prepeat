import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ds } from "@/constants/ds";

/**
 * "Invite someone" (Figma "invite", 2026-07-22). The sheet keeps the Household
 * page clean and focuses the user on one task: the simple old way of sharing –
 * show the code, copy it, or share it through the OS. No email step (Thomas,
 * 2026-07-22: the old sharing was simpler and better). Current tokens pending
 * the DS retune.
 */
export function InviteSomeoneSheet({
  visible,
  onClose,
  householdName,
  inviteCode,
}: {
  visible: boolean;
  onClose: () => void;
  householdName: string;
  inviteCode: string | null;
}) {
  return (
    <BottomSheet visible={visible} title="Invite someone" onClose={onClose}>
      {visible && <SheetContent householdName={householdName} inviteCode={inviteCode} />}
    </BottomSheet>
  );
}

function SheetContent({
  householdName,
  inviteCode,
}: {
  householdName: string;
  inviteCode: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    if (inviteCode == null) return;
    try {
      await Clipboard.setStringAsync(inviteCode);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("[household] copy failed", error);
    }
  };

  const share = async () => {
    if (inviteCode == null) return;
    try {
      await Share.share({
        message: `Join our household "${householdName}" in Prep+Eat with the code ${inviteCode}`,
      });
    } catch {
      // Sharing cancelled – nothing to do.
    }
  };

  return (
    <View className="w-full gap-layout-small">
      <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
        Invite a family member or a friend to your household.
      </Text>

      {/* Invite code with copy. The left spacer mirrors the icon so the code
          stays optically centered. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? "Copied" : "Copy code"}
        onPress={copy}
        disabled={inviteCode == null}
        className="w-full flex-row items-center gap-comp-small rounded-medium bg-surface-neutral-lighter p-layout-small"
      >
        <View className="w-[24px]" />
        <Text
          numberOfLines={1}
          className="flex-1 text-center font-header text-display-4 font-emphasized leading-medium text-text-brand"
        >
          {inviteCode ?? "…"}
        </Text>
        <MaterialIcons
          name={copied ? "check" : "content-copy"}
          size={24}
          color={copied ? ds.colors.text.brand : ds.colors.icon.default}
        />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={inviteCode == null}
        onPress={share}
        className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium bg-button-solid-fill-enabled py-comp-large"
      >
        <MaterialIcons name="ios-share" size={24} color={ds.colors.button.solid.label.enabled} />
        <Text className="font-paragraph text-components-button-label font-default text-button-solid-label-enabled">
          Share the code
        </Text>
      </Pressable>
    </View>
  );
}
