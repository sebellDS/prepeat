import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ClearableInput } from "@/components/ui/input";
import { ds } from "@/constants/ds";
import { updateHousehold, type Household } from "@/lib/household";

/**
 * "Edit household" (Figma "edit household" / "delete household", reworked
 * 2026-07-22): rename the household (name-only – the image was dropped), and
 * Delete household when you're its sole member with another to keep (a shared
 * household uses Leave instead; docs/backlog "Delete household"). Any member
 * may rename – no roles.
 */
export function EditHouseholdSheet({
  visible,
  household,
  canDelete,
  onClose,
  onSaved,
  onDelete,
}: {
  visible: boolean;
  household: Household;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (updated: Household) => void;
  onDelete: () => void;
}) {
  return (
    <BottomSheet visible={visible} title="Edit household" onClose={onClose}>
      {visible && (
        <SheetContent
          household={household}
          canDelete={canDelete}
          onClose={onClose}
          onSaved={onSaved}
          onDelete={onDelete}
        />
      )}
    </BottomSheet>
  );
}

function SheetContent({
  household,
  canDelete,
  onClose,
  onSaved,
  onDelete,
}: {
  household: Household;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (updated: Household) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(household.name);
  const [busy, setBusy] = useState(false);
  const canSave = name.trim().length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await updateHousehold(household.id, { name: name.trim() });
      onSaved({ ...household, name: name.trim() });
      onClose();
    } catch (error) {
      console.warn("[household] save failed", error);
      setBusy(false);
    }
  };

  return (
    <View className="w-full gap-layout-small">
      <View className="w-full gap-comp-small">
        <Text className="font-paragraph text-components-label font-default leading-xxsmall text-text-subtle">
          Household name
        </Text>
        <ClearableInput
          value={name}
          onChangeText={setName}
          accessibilityLabel="Household name"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={save}
        />
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
          {busy ? "Saving…" : "Save household"}
        </Text>
      </Pressable>
      {canDelete && (
        <>
          <Text className="w-full font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
            If you delete this household, all its plans, recipes and shopping
            lists will be deleted. This cannot be undone.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onDelete}
            className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium bg-button-danger-fill-enabled py-comp-large"
          >
            <MaterialIcons
              name="delete-outline"
              size={24}
              color={ds.colors.error["contrast-text"]}
            />
            <Text className="font-paragraph text-components-button-label font-default text-button-danger-label-enabled">
              Delete household
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
