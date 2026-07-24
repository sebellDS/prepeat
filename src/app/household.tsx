import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { DeleteHouseholdSheet } from "@/components/household/delete-household-sheet";
import { DeleteProfileSheet } from "@/components/household/delete-profile-sheet";
import { EditHouseholdSheet } from "@/components/household/edit-household-sheet";
import { EditProfileSheet } from "@/components/household/edit-profile-sheet";
import { InviteSomeoneSheet } from "@/components/household/invite-someone-sheet";
import { JoinHouseholdModal } from "@/components/household/join-household-modal";
import { LeaveHouseholdSheet } from "@/components/household/leave-household-sheet";
import { ds } from "@/constants/ds";
import { BottomTabInset } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { useHouseholdSwitcher } from "@/lib/household-context";
import {
  deleteHousehold,
  deleteProfile,
  fetchHouseholdMembers,
  getOrCreateInvite,
  leaveHousehold,
  regenerateInvite,
  type Household,
  type HouseholdMember,
  type Invite,
} from "@/lib/household";

// The Household tab (Figma "Household" page, reworked 2026-07-22): the
// "Household ▾" title opens a switcher over every household the user belongs
// to plus "Join a household"; the card carries the member directory and an
// "Invite someone" action; sign out at the bottom. Built on the app's current
// tokens – the sage/Noto DS retune the mock references is a separate job.
export default function HouseholdScreen() {
  const { session, firstName, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const myUserId = session?.user?.id ?? null;
  const {
    household,
    households,
    setActiveHousehold,
    addHousehold,
    applyHouseholdUpdate,
    removeHousehold,
  } = useHouseholdSwitcher();

  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [sheet, setSheet] = useState<
    | "none"
    | "household"
    | "profile"
    | "invite"
    | "leave"
    | "deleteProfile"
    | "deleteHousehold"
  >("none");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const loadMembers = useCallback((householdId: string) => {
    fetchHouseholdMembers(householdId)
      .then(setMembers)
      .catch((error) => console.warn("[household] members load failed", error));
  }, []);

  // Load the directory and invite code for the active household. Switching
  // household remounts the tab tree (RootGate keys AppTabs on the active id),
  // so this mounts fresh per household – no manual reset needed.
  useEffect(() => {
    let cancelled = false;
    loadMembers(household.id);
    getOrCreateInvite(household.id)
      .then((next) => {
        if (!cancelled) setInvite(next);
      })
      .catch((error) => console.warn("[household] invite failed", error));
    return () => {
      cancelled = true;
    };
  }, [household.id, loadMembers]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-neutral-lightest">
      {/* Header + switcher trigger */}
      <View className="w-full flex-row items-center gap-comp-small px-layout-small pb-layout-small">
        <Text className="flex-1 font-header text-display-4 font-emphasized leading-medium text-text-default">
          Household
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch household"
          hitSlop={8}
          onPress={() => setSwitcherOpen(true)}
        >
          <MaterialIcons name="expand-more" size={32} color={ds.colors.icon.default} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          gap: 16,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + BottomTabInset + 24,
        }}
      >
        {/* Household card + invite */}
        <View className="w-full overflow-hidden rounded-large bg-surface-neutral-white">
          <View className="w-full flex-row items-center gap-layout-small border-b border-border-subtle p-layout-small">
            <View className="min-w-0 flex-1">
              <Text
                numberOfLines={1}
                className="font-header text-display-6 font-emphasized leading-xsmall text-text-accent"
              >
                {household.name}
              </Text>
              <View className="flex-row items-center gap-comp-small">
                <MaterialIcons name="people-alt" size={16} color={ds.colors.icon.default} />
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
          <View className="w-full items-center gap-layout-small p-layout-small">
            <Text className="w-full font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
              Invite a family member or a friend to your household.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSheet("invite")}
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

        {/* Sign out */}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            signOut().catch((error) => console.warn("[household] sign out failed", error))
          }
          className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium border-2 border-button-outline-border-enabled py-comp-large"
        >
          <MaterialIcons name="logout" size={24} color={ds.colors.button.outline.label.enabled} />
          <Text className="font-paragraph text-components-button-label font-default text-button-outline-label-enabled">
            Sign out
          </Text>
        </Pressable>
      </ScrollView>

      <EditHouseholdSheet
        visible={sheet === "household"}
        household={household}
        canDelete={members.length === 1 && households.length > 1}
        onClose={() => setSheet("none")}
        onSaved={applyHouseholdUpdate}
        onDelete={() => setSheet("deleteHousehold")}
      />
      <EditProfileSheet
        visible={sheet === "profile"}
        canLeave={members.length > 1}
        onClose={() => setSheet("none")}
        onSaved={() => {
          // The 0010 auth trigger has mirrored the new name into profiles –
          // refetch so the member row follows.
          loadMembers(household.id);
        }}
        onLeave={() => setSheet("leave")}
        onDelete={() => setSheet("deleteProfile")}
      />
      <InviteSomeoneSheet
        visible={sheet === "invite"}
        onClose={() => setSheet("none")}
        householdName={household.name}
        invite={invite}
        onRegenerate={async () => {
          const next = await regenerateInvite(household.id);
          setInvite(next);
          return next;
        }}
      />
      <LeaveHouseholdSheet
        visible={sheet === "leave"}
        householdName={household.name}
        onClose={() => setSheet("none")}
        onConfirm={async () => {
          const newHousehold = await leaveHousehold(household.id);
          // Drop the household we left and switch into the new kitchen
          // (addHousehold makes it active, remounting the tabs).
          removeHousehold(household.id);
          addHousehold(newHousehold);
        }}
      />
      <DeleteProfileSheet
        visible={sheet === "deleteProfile"}
        firstName={firstName}
        onClose={() => setSheet("none")}
        onConfirm={async () => {
          await deleteProfile();
          // The account is gone server-side; clear the local session, which
          // drops back to onboarding.
          await signOut();
        }}
      />
      <DeleteHouseholdSheet
        visible={sheet === "deleteHousehold"}
        householdName={household.name}
        onClose={() => setSheet("none")}
        onConfirm={async () => {
          await deleteHousehold(household.id);
          // Switch to another of your households (canDelete guarantees one
          // exists), then drop the deleted one. Switching remounts the tabs.
          const other = households.find((h) => h.id !== household.id);
          if (other) setActiveHousehold(other.id);
          removeHousehold(household.id);
        }}
      />

      <HouseholdSwitcherMenu
        visible={switcherOpen}
        households={households}
        activeId={household.id}
        topInset={insets.top}
        onSelect={(id) => {
          setSwitcherOpen(false);
          if (id !== household.id) setActiveHousehold(id);
        }}
        onJoin={() => {
          setSwitcherOpen(false);
          setJoinOpen(true);
        }}
        onClose={() => setSwitcherOpen(false)}
      />

      <JoinHouseholdModal
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={(joined) => {
          setJoinOpen(false);
          addHousehold(joined);
        }}
      />
    </SafeAreaView>
  );
}

/**
 * The household switcher, opened from the "Household ▾" title. Lists every
 * household the user belongs to (checkmark on the active one) plus a
 * "Join a household" action, as a dropdown card below the header over a dim
 * backdrop.
 */
function HouseholdSwitcherMenu({
  visible,
  households,
  activeId,
  topInset,
  onSelect,
  onJoin,
  onClose,
}: {
  visible: boolean;
  households: Household[];
  activeId: string;
  topInset: number;
  onSelect: (id: string) => void;
  onJoin: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1"
        style={{ backgroundColor: "rgba(0,0,0,0.15)" }}
        onPress={onClose}
      >
        <View style={{ paddingTop: topInset + 52, paddingHorizontal: 16 }}>
          <Pressable
            onPress={() => {}}
            className="w-full overflow-hidden rounded-large bg-surface-neutral-white"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            {households.map((h) => (
              <Pressable
                key={h.id}
                accessibilityRole="button"
                onPress={() => onSelect(h.id)}
                className="w-full flex-row items-center gap-layout-small border-b border-border-subtle p-layout-small"
              >
                <MaterialIcons name="home" size={24} color={ds.colors.icon.default} />
                <Text
                  numberOfLines={1}
                  className="min-w-0 flex-1 font-paragraph text-paragraph font-default leading-xsmall text-text-default"
                >
                  {h.name}
                </Text>
                {h.id === activeId && (
                  <MaterialIcons name="check" size={24} color={ds.colors.text.brand} />
                )}
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={onJoin}
              className="w-full flex-row items-center gap-layout-small p-layout-small"
            >
              <MaterialIcons name="group-add" size={24} color={ds.colors.icon.default} />
              <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
                Join a household
              </Text>
            </Pressable>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
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
  const initial = (member.firstName ?? member.email ?? "?").charAt(0).toUpperCase();
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
