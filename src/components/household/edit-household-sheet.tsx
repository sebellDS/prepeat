import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ClearableInput } from "@/components/ui/input";
import { ds } from "@/constants/ds";
import { updateHousehold, type Household } from "@/lib/household";
import { uploadRecipePhoto } from "@/lib/recipes";

/**
 * "Edit household" (Figma 213:66120, designed 2026-07-18): rename the
 * household and give it an image. Any member may – no roles. The picked
 * image previews above the button (borrowed from the recipe form; the
 * frame draws no picked state – flagged in the backlog), and the save
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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSave = name.trim().length > 0 && !busy;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      // The household image lives in the recipe-photos bucket – its
      // policies are already per-household-folder (migration 0010 note).
      const imageUrl =
        photoUri != null
          ? await uploadRecipePhoto(household.id, photoUri)
          : undefined;
      await updateHousehold(household.id, { name: name.trim(), imageUrl });
      onSaved({
        ...household,
        name: name.trim(),
        imageUrl: imageUrl ?? household.imageUrl,
      });
      onClose();
    } catch (error) {
      console.warn("[household] save failed", error);
      setBusy(false);
    }
  };

  const preview = photoUri ?? household.imageUrl;

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
        />
      </View>
      {preview != null && (
        <View className="w-full items-center">
          <Image
            source={{ uri: preview }}
            style={{ width: 88, height: 88, borderRadius: 12 }}
            contentFit="cover"
          />
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={pickImage}
        className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium border-2 border-button-outline-border-enabled py-comp-large"
      >
        <MaterialIcons
          name="add-photo-alternate"
          size={24}
          color={ds.colors.button.outline.label.enabled}
        />
        <Text className="font-paragraph text-components-button-label font-default text-button-outline-label-enabled">
          {preview != null ? "Change the image" : "Add an image"}
        </Text>
      </Pressable>
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
