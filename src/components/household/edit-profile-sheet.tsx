import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ClearableInput } from "@/components/ui/input";
import { ds } from "@/constants/ds";
import { useAuth } from "@/lib/auth";

/**
 * "Edit profile" (Figma "edit your profile", 2026-07-18 / reworked
 * 2026-07-22): first name is editable, email is read-only (the email is the
 * sign-in identity; changing it is an account flow, not a profile field).
 * This sheet also hosts the personal household actions – Leave household
 * (when there are other members) and, later, Delete profile. Saving goes
 * through auth metadata; the 0010 trigger mirrors it into profiles so the
 * member list follows.
 */
export function EditProfileSheet({
  visible,
  canLeave,
  onClose,
  onSaved,
  onLeave,
  onDelete,
}: {
  visible: boolean;
  // Leaving is offered only when the household has other members – a solo
  // household has nobody to leave (docs/leave-household.md).
  canLeave: boolean;
  onClose: () => void;
  onSaved: (firstName: string) => void;
  onLeave: () => void;
  onDelete: () => void;
}) {
  return (
    <BottomSheet visible={visible} title="Edit profile" onClose={onClose}>
      {visible && (
        <SheetContent
          canLeave={canLeave}
          onClose={onClose}
          onSaved={onSaved}
          onLeave={onLeave}
          onDelete={onDelete}
        />
      )}
    </BottomSheet>
  );
}

function SheetContent({
  canLeave,
  onClose,
  onSaved,
  onLeave,
  onDelete,
}: {
  canLeave: boolean;
  onClose: () => void;
  onSaved: (firstName: string) => void;
  onLeave: () => void;
  onDelete: () => void;
}) {
  const { session, firstName, saveFirstName } = useAuth();
  const [name, setName] = useState(firstName ?? "");
  const [busy, setBusy] = useState(false);
  const canSave = name.trim().length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await saveFirstName(name);
      onSaved(name.trim());
      onClose();
    } catch (error) {
      console.warn("[household] profile save failed", error);
      setBusy(false);
    }
  };

  return (
    <View className="w-full gap-layout-small">
      <View className="w-full gap-comp-small">
        <Text className="font-paragraph text-components-label font-default leading-xxsmall text-text-subtle">
          First name
        </Text>
        <ClearableInput
          value={name}
          onChangeText={setName}
          accessibilityLabel="First name"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </View>
      <View className="w-full gap-comp-small">
        <Text className="font-paragraph text-components-label font-default leading-xxsmall text-text-subtle">
          Email
        </Text>
        {/* Read-only (subdued border, Figma 213:66305) – shows which
            account is being edited. */}
        <View className="w-full rounded-medium border border-forms-border-subdued bg-forms-background-default p-comp-large">
          <Text className="font-paragraph text-paragraph font-default text-text-default">
            {session?.user?.email ?? ""}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={!canSave}
        onPress={save}
        className={
          "w-full items-center rounded-medium py-comp-large " +
          (canSave ? "bg-button-solid-fill-enabled" : "bg-surface-neutral-light")
        }
      >
        <Text
          className={
            "font-paragraph text-components-button-label font-default " +
            (canSave ? "text-button-solid-label-enabled" : "text-text-disabled")
          }
        >
          {busy ? "Saving…" : "Save profile"}
        </Text>
      </Pressable>
      {canLeave && (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onLeave}
          className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium border-2 border-error py-comp-large"
        >
          <MaterialIcons name="logout" size={24} color={ds.colors.error.main} />
          <Text className="font-paragraph text-components-button-label font-default text-error">
            Leave household
          </Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onDelete}
        className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium border-2 border-error py-comp-large"
      >
        <MaterialIcons name="delete-outline" size={24} color={ds.colors.error.main} />
        <Text className="font-paragraph text-components-button-label font-default text-error">
          Delete profile
        </Text>
      </Pressable>
    </View>
  );
}
