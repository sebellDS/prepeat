import { MaterialIcons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { ds } from "@/constants/ds";

/**
 * The shared bottom-sheet shell (backlog debt, extracted 2026-07-16 for the
 * Plan milestone): Modal + keyboard avoidance + backdrop + white card with
 * a title row and close button. Carries the keyboard-bleed fix
 * (marginBottom -80 / paddingBottom 120) so new sheets inherit it and it
 * cannot drift between copies.
 *
 * Children re-mount every time the sheet opens (they render only while
 * visible), so field state resets per open without key juggling.
 */
export function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  onBack,
  scroll = false,
  footer,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /**
   * Multi-step flows (Figma 181:45301): a top row with a back arrow left
   * and the close right, the title block below – instead of the default
   * inline title + close row.
   */
  onBack?: () => void;
  /**
   * Wrap the body in a ScrollView capped at 90% height (long content). The
   * sheet also takes a minimum height then, so it uses the screen rather than
   * hugging a short form.
   */
  scroll?: boolean;
  /**
   * Pinned below the scroll area – for a CTA that must stay reachable however
   * long the body is, or however much of the screen the keyboard takes
   * (Thomas, 2026-07-25: the edit-item "Done" fell below the fold).
   */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {visible && (
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
            style={{
              marginBottom: -80,
              paddingBottom: 120,
              ...(scroll
                ? { maxHeight: "90%" as const, minHeight: "55%" as const }
                : null),
            }}
            className="w-full gap-layout-small rounded-t-xlarge bg-surface-neutral-lightest p-layout-small"
          >
            {onBack ? (
              <View className="w-full flex-row items-center justify-between">
                <Pressable
                  onPress={onBack}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={28}
                    color={ds.colors.surface.primary.main}
                  />
                </Pressable>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <MaterialIcons
                    name="close"
                    size={28}
                    color={ds.colors.icon.default}
                  />
                </Pressable>
              </View>
            ) : null}
            <View className="w-full gap-comp-xsmall">
              <View className="w-full flex-row items-center">
                <Text className="flex-1 font-header text-display-5 font-emphasized text-text-default">
                  {title}
                </Text>
                {!onBack && (
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
                )}
              </View>
              {subtitle ? (
                <Text className="font-paragraph text-small font-default text-text-subtle">
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {scroll ? (
              <ScrollView
                style={{ flexShrink: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View className="w-full gap-layout-small">{children}</View>
              </ScrollView>
            ) : (
              children
            )}
            {footer}
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}
