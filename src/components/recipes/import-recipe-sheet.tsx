import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import { Input } from "@/components/ui/input";
import { ds } from "@/constants/ds";
import { importRecipeFromUrl, type ImportedRecipe } from "@/lib/recipe-import";

/**
 * Paste-a-link import: fetches the page, reads its embedded recipe data
 * and hands the result to the Add-recipe form for review. No design frame
 * for this yet – styled from the app's sheet pattern.
 */
export function ImportRecipeSheet({
  visible,
  onClose,
  onImported,
}: {
  visible: boolean;
  onClose: () => void;
  onImported: (recipe: ImportedRecipe) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {visible && <SheetContent onClose={onClose} onImported={onImported} />}
    </Modal>
  );
}

function SheetContent({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (recipe: ImportedRecipe) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runImport = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const recipe = await importRecipeFromUrl(url);
      onImported(recipe);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Something went wrong – please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 justify-end"
    >
      <Pressable
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        className="bg-black/30"
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View
        style={{ marginBottom: -80, paddingBottom: 120 }}
        className="w-full gap-layout-small rounded-t-xlarge bg-surface-neutral-white p-layout-small"
      >
        <View className="w-full flex-row items-center">
          <Text className="flex-1 font-header text-display-5 font-emphasized text-text-default">
            Add from a link
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <SymbolView
              name="xmark"
              size={20}
              tintColor={ds.colors.icon.default}
            />
          </Pressable>
        </View>
        <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
          Paste a link to a recipe page – the ingredients and steps fill in by
          themselves, ready for you to adjust.
        </Text>
        {error != null && (
          <View className="w-full rounded-medium bg-error-lightest px-comp-large py-comp-small">
            <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
              {error}
            </Text>
          </View>
        )}
        <Input
          value={url}
          onChangeText={setUrl}
          placeholder="https://…"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          accessibilityLabel="Recipe link"
          onSubmitEditing={runImport}
          returnKeyType="go"
        />
        <Pressable
          onPress={runImport}
          disabled={busy || url.trim().length === 0}
          accessibilityRole="button"
          className={
            "w-full items-center rounded-medium py-comp-large " +
            (busy || url.trim().length === 0
              ? "bg-surface-neutral-main"
              : "bg-button-solid-fill-enabled")
          }
        >
          {busy ? (
            <ActivityIndicator color={ds.colors.text.inverse} />
          ) : (
            <Text className="font-paragraph text-components-button-label font-default text-button-solid-label-enabled">
              Import recipe
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
