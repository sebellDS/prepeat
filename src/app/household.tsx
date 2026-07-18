import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { EditHouseholdSheet } from "@/components/household/edit-household-sheet";
import { EditProfileSheet } from "@/components/household/edit-profile-sheet";
import { ds } from "@/constants/ds";
import { BottomTabInset } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import {
  fetchHouseholdMembers,
  fetchMyHousehold,
  getOrCreateInvite,
  type Household,
  type HouseholdMember,
} from "@/lib/household";

// The Household tab (Figma section 213:65932, designed 2026-07-18):
// household card with image + rename sheet, the member directory
// (profiles, migration 0010), the invite code with copy + share, and
// sign out. Everyone is equal – no roles (reaffirmed 2026-07-18); the
// pencil on your own member row is the only per-user difference, and
// name changes reach other phones at next app open (no realtime here).
export default function HouseholdScreen() {
  const { session, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const myUserId = session?.user?.id ?? null;

  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"none" | "household" | "profile">("none");

  const loadMembers = useCallback((householdId: string) => {
    fetchHouseholdMembers(householdId)
      .then(setMembers)
      .catch((error) => console.warn("[household] members load failed", error));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMyHousehold()
      .then((mine) => {
        if (cancelled || mine == null) return;
        setHousehold(mine);
        loadMembers(mine.id);
        getOrCreateInvite(mine.id)
          .then((code) => {
            if (!cancelled) setInviteCode(code);
          })
          .catch((error) => console.warn("[household] invite failed", error));
      })
      .catch((error) => console.warn("[household] load failed", error));
    return () => {
      cancelled = true;
    };
  }, [loadMembers]);

  const share = async () => {
    if (!household || !inviteCode) return;
    try {
      await Share.share({
        message: `Join our household "${household.name}" in Prep+Eat with the code ${inviteCode}`,
      });
    } catch {
      // Sharing cancelled – nothing to do.
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-neutral-lightest">
      <View className="w-full px-layout-small pb-layout-small">
        <Text className="font-header text-display-4 font-emphasized leading-medium text-text-default">
          Household
        </Text>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          gap: 16,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + BottomTabInset + 24,
        }}
      >
        {/* Household card */}
        <View className="w-full flex-row items-center gap-layout-small rounded-large bg-surface-neutral-white p-layout-small">
          {household?.imageUrl ? (
            <Image
              source={{ uri: household.imageUrl }}
              style={{ width: 56, height: 56, borderRadius: 12 }}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={[
                ds.colors.surface.primary.main,
                ds.colors.surface.primary.light,
              ]}
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons
                name="home"
                size={24}
                color={ds.colors.surface.neutral.white}
              />
            </LinearGradient>
          )}
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={1}
              className="font-header text-display-6 font-emphasized leading-xsmall text-text-accent"
            >
              {household?.name ?? "…"}
            </Text>
            <View className="flex-row items-center gap-comp-small">
              <MaterialIcons
                name="people-alt"
                size={16}
                color={ds.colors.icon.default}
              />
              <Text className="font-paragraph text-small font-default leading-xxsmall text-text-default">
                {members.length === 1 ? "1 member" : `${members.length} members`}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit household"
            hitSlop={8}
            onPress={() => setSheet("household")}
          >
            <MaterialIcons name="edit" size={24} color={ds.colors.icon.default} />
          </Pressable>
        </View>

        {/* Members */}
        <View className="w-full gap-comp-small">
          <Text className="font-paragraph text-small font-emphasized leading-xxsmall text-text-default">
            Members
          </Text>
          <View className="w-full overflow-hidden rounded-large bg-surface-neutral-white">
            {members.map((member, index) => (
              <MemberRow
                key={member.userId}
                member={member}
                isMe={member.userId === myUserId}
                isLast={index === members.length - 1}
                onEdit={() => setSheet("profile")}
              />
            ))}
          </View>
        </View>

        {/* Sharing */}
        <View className="w-full gap-comp-small">
          <Text className="font-paragraph text-small font-emphasized leading-xxsmall text-text-default">
            Sharing
          </Text>
          <View className="w-full gap-layout-small rounded-large bg-surface-neutral-white p-layout-small">
            <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
              Share this code so your family can join.
            </Text>
            <InviteCodeBox code={inviteCode} />
            <Pressable
              accessibilityRole="button"
              disabled={inviteCode == null}
              onPress={share}
              className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium bg-button-solid-fill-enabled py-comp-large"
            >
              <MaterialIcons
                name="ios-share"
                size={24}
                color={ds.colors.button.solid.label.enabled}
              />
              <Text className="font-paragraph text-components-button-label font-default text-button-solid-label-enabled">
                Share the code
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Sign out */}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            signOut().catch((error) =>
              console.warn("[household] sign out failed", error),
            )
          }
          className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium border-2 border-button-outline-border-enabled py-comp-large"
        >
          <MaterialIcons
            name="logout"
            size={24}
            color={ds.colors.button.outline.label.enabled}
          />
          <Text className="font-paragraph text-components-button-label font-default text-button-outline-label-enabled">
            Sign out
          </Text>
        </Pressable>
      </ScrollView>

      {household != null && (
        <EditHouseholdSheet
          visible={sheet === "household"}
          household={household}
          onClose={() => setSheet("none")}
          onSaved={(updated) => setHousehold(updated)}
        />
      )}
      <EditProfileSheet
        visible={sheet === "profile"}
        onClose={() => setSheet("none")}
        onSaved={() => {
          // The 0010 auth trigger has mirrored the new name into
          // profiles – refetch so the member row follows.
          if (household) loadMembers(household.id);
        }}
      />
    </SafeAreaView>
  );
}

/**
 * A member row. The phone owner's avatar is outlined, everyone else's is
 * solid (avatar rule, Thomas 2026-07-18) – and only your own row carries
 * the edit pencil (you can only edit yourself; everyone is equal).
 */
function MemberRow({
  member,
  isMe,
  isLast,
  onEdit,
}: {
  member: HouseholdMember;
  isMe: boolean;
  isLast: boolean;
  onEdit: () => void;
}) {
  const initial = (member.firstName ?? member.email ?? "?")
    .charAt(0)
    .toUpperCase();
  return (
    <View
      className={
        "w-full flex-row items-center gap-layout-small p-layout-small " +
        (isLast ? "" : "border-b border-border-subtle")
      }
    >
      <View
        className={
          "h-[40px] w-[40px] items-center justify-center rounded-full " +
          (isMe
            ? "border border-border-strong bg-surface-neutral-lighter"
            : "bg-surface-secondary-main")
        }
      >
        <Text
          className={
            "font-header text-display-6 font-emphasized leading-xsmall " +
            (isMe ? "text-text-subtle" : "text-text-inverse")
          }
        >
          {initial}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className="font-header text-display-6 font-emphasized leading-xsmall text-text-accent"
        >
          {member.firstName ?? "…"}
        </Text>
        <View className="flex-row items-center gap-comp-small">
          <MaterialIcons name="mail" size={16} color={ds.colors.icon.default} />
          <Text
            numberOfLines={1}
            className="min-w-0 flex-1 font-paragraph text-small font-default leading-xxsmall text-text-default"
          >
            {member.email ?? ""}
          </Text>
        </View>
      </View>
      {isMe && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          hitSlop={8}
          onPress={onEdit}
        >
          <MaterialIcons name="edit" size={24} color={ds.colors.icon.default} />
        </Pressable>
      )}
    </View>
  );
}

/**
 * The big invite code with the copy control (Figma 213:65644). Copying
 * flips the icon to a checkmark for a moment (improvised feedback,
 * blessed 2026-07-18). The left spacer mirrors the icon so the code stays
 * optically centered, as in the frame's three-column grid.
 */
function InviteCodeBox({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

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

  return (
    <View className="w-full flex-row items-center gap-comp-small rounded-medium bg-surface-neutral-lighter p-layout-small">
      <View className="w-[24px]" />
      <Text
        numberOfLines={1}
        className="flex-1 text-center font-header text-display-4 font-emphasized leading-medium text-text-brand"
      >
        {code ?? "…"}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? "Copied" : "Copy code"}
        hitSlop={8}
        disabled={code == null}
        onPress={copy}
      >
        <MaterialIcons
          name={copied ? "check" : "content-copy"}
          size={24}
          color={copied ? ds.colors.text.brand : ds.colors.icon.default}
        />
      </Pressable>
    </View>
  );
}
