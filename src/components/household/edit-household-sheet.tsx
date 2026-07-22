import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ClearableInput } from "@/components/ui/input";
import { updateHousehold, type Household } from "@/lib/household";

/**
 * "Edit household" (Figma "edit household", designed 2026-07-18 / reworked
 * 2026-07-22): rename the household. Any member may – no roles. The household
 * image was dropped from the design 2026-07-22, so this is name-only; the save
 * button disables on an empty name (same convention as the other sheets).
 */
export function EditHouseholdSheet({
  visible,
  household,
  onClose,
  onSaved,
}: {
  visible: boolean;
  household: Household;
  onClose: () => void;
  onSaved: (updated: Household) => void;
}) {
  return (
    <BottomSheet visible={visible} title="Edit household" onClose={onClose}>
      {visible && (
        <SheetContent household={household} onClose={onClose} onSaved={onSaved} />
      )}
    </BottomSheet>
  );
}

function SheetContent({
  household,
  onClose,
  onSaved,
}: {
  household: Household;
  onClose: () => void;
  onSaved: (updated: Household) => void;
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
    </View>
  );
}
