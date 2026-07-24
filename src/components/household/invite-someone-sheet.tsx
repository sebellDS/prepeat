import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Share, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ds } from "@/constants/ds";
import type { Invite } from "@/lib/household";

/**
 * "Invite someone" (Figma "Householde – invite", node 271:14935, built to spec
 * 2026-07-24). Show the code, copy it (tap the chip), or share it through the
 * OS (the primary "Invite someone" button). No email step (Thomas, 2026-07-22:
 * the old sharing was simpler and better).
 *
 * Invite codes expire after 14 days and rotate automatically; the "Refreshes
 * on {date}" line makes that visible, and the "Get a new code" text link
 * retires the current code on demand so a leaked one can be killed at once.
 */
export function InviteSomeoneSheet({
  visible,
  onClose,
  householdName,
  invite,
  onRegenerate,
}: {
  visible: boolean;
  onClose: () => void;
  householdName: string;
  invite: Invite | null;
  onRegenerate: () => Promise<Invite>;
}) {
  return (
    <BottomSheet visible={visible} title="Invite someone" onClose={onClose}>
      {visible && (
        <SheetContent
          householdName={householdName}
          invite={invite}
          onRegenerate={onRegenerate}
        />
      )}
    </BottomSheet>
  );
}

/** "Refreshes on August 2, 2026" – English month-day-year, per the English UI. */
function formatRefreshDate(expiresAt: number): string {
  return new Date(expiresAt).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function SheetContent({
  householdName,
  invite,
  onRegenerate,
}: {
  householdName: string;
  invite: Invite | null;
  onRegenerate: () => Promise<Invite>;
}) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const code = invite?.code ?? null;

  const copy = async () => {
    if (code == null) return;
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("[household] copy failed", error);
    }
  };

  const share = async () => {
    if (code == null) return;
    try {
      await Share.share({
        message: `Join our household "${householdName}" in Prep+Eat with the code ${code}`,
      });
    } catch {
      // Sharing cancelled – nothing to do.
    }
  };

  const runRegenerate = async () => {
    setRegenerating(true);
    try {
      await onRegenerate();
      setCopied(false);
    } catch (error) {
      console.warn("[household] regenerate failed", error);
      Alert.alert("Could not make a new code", "Please try again in a moment.");
    } finally {
      setRegenerating(false);
    }
  };

  // Regenerate kills the current code for everyone holding it, so confirm first.
  const confirmRegenerate = () => {
    if (code == null || regenerating) return;
    Alert.alert(
      "Get a new code?",
      "The current code stops working right away. Anyone you already shared it with will need the new one.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "New code", style: "destructive", onPress: runRegenerate },
      ],
    );
  };

  return (
    <View className="w-full gap-layout-medium">
      {/* Intro + code + refresh row, 16px apart (Figma content group). */}
      <View className="w-full gap-layout-small">
        <Text className="w-full font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
          Invite a family member or a friend or give them the code below.
        </Text>

        {/* Code chip with copy. The left spacer mirrors the icon column so the
            code stays optically centered (Figma [24px | 1fr | 24px] grid). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? "Copied" : "Copy code"}
          onPress={copy}
          disabled={code == null}
          className="w-full flex-row items-center gap-comp-small rounded-medium bg-surface-neutral-lighter p-layout-small"
        >
          <View className="w-[24px]" />
          <Text
            numberOfLines={1}
            className="flex-1 text-center font-header text-display-5 font-emphasized leading-small text-text-default"
          >
            {code ?? "…"}
          </Text>
          <MaterialIcons
            name={copied ? "check" : "content-copy"}
            size={24}
            color={copied ? ds.colors.text.brand : ds.colors.icon.default}
          />
        </Pressable>

        {/* Refresh date (left) + manual rotation link (right). */}
        <View className="w-full flex-row items-center gap-comp-small">
          <Text className="flex-1 font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
            {invite ? `Refreshes on ${formatRefreshDate(invite.expiresAt)}` : " "}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get a new code"
            disabled={code == null || regenerating}
            onPress={confirmRegenerate}
            className="flex-row items-center gap-comp-xsmall border-b-2 border-button-text-underline-enabled"
          >
            {regenerating ? (
              <ActivityIndicator size="small" color={ds.colors.text.subtle} />
            ) : (
              <MaterialIcons name="refresh" size={16} color={ds.colors.text.subtle} />
            )}
            <Text className="font-paragraph text-paragraph font-default leading-xsmall text-button-text-label-enabled">
              Get a new code
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Primary action – opens the OS share sheet with the code. */}
      <Pressable
        accessibilityRole="button"
        disabled={code == null}
        onPress={share}
        className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium bg-button-solid-fill-enabled px-comp-xlarge py-comp-large"
      >
        <MaterialIcons
          name="person-add-alt-1"
          size={24}
          color={ds.colors.button.solid.label.enabled}
        />
        <Text className="font-paragraph text-components-button-label font-default text-button-solid-label-enabled">
          Invite someone
        </Text>
      </Pressable>
    </View>
  );
}
