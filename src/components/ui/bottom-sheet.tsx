import { MaterialIcons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
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

// A scroll-mode sheet exposes its ScrollView to its own body, so a section can
// scroll itself into view – e.g. the edit-item sheet brings the category list
// up when its picker opens. null outside a scroll sheet, so consumers no-op.
const BottomSheetScrollContext = createContext<RefObject<ScrollView | null> | null>(
  null,
);

export function useBottomSheetScroll(): RefObject<ScrollView | null> | null {
  return useContext(BottomSheetScrollContext);
}

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
  minHeightPercent = 55,
  maxHeightPercent = 90,
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
   * Wrap the body in a ScrollView capped at maxHeightPercent (long content).
   * The sheet also takes a minimum height then, so it uses the screen rather
   * than hugging a short form.
   */
  scroll?: boolean;
  /**
   * How tall the scroll sheet opens (percent of screen). Defaults to 55;
   * raise it for a sheet whose body needs room on open, or pass 0 to hug the
   * content (e.g. the edit-item sheet, short until its picker opens).
   */
  minHeightPercent?: number;
  /**
   * The ceiling the scroll sheet grows to (percent of screen). Defaults to 90;
   * raise it for a sheet that should use almost the whole screen when full –
   * e.g. the edit-item category list.
   */
  maxHeightPercent?: number;
  /**
   * Pinned below the scroll area – for a CTA that must stay reachable however
   * long the body is, or however much of the screen the keyboard takes
   * (Thomas, 2026-07-25: the edit-item "Done" fell below the fold).
   */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const scrollRef = useRef<ScrollView>(null);
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
              // Figma 508:13824 / 495:4756. marginBottom -80 with paddingBottom
              // 120 already leaves the 40px the design asks for, so the
              // keyboard-bleed fix and the spec happen to agree - do not
              // "correct" one into breaking the other.
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.25,
              shadowRadius: 24,
              elevation: 12,
              ...(scroll
                ? {
                    maxHeight: `${maxHeightPercent}%` as const,
                    // A falsy percent means "hug the content" (cap at the max
                    // and scroll past that) – the sheet grows with its body
                    // instead of reserving empty space below a short form.
                    ...(minHeightPercent
                      ? { minHeight: `${minHeightPercent}%` as const }
                      : null),
                  }
                : null),
            }}
            className="w-full gap-layout-medium rounded-t-large bg-surface-neutral-lightest p-layout-small"
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
            <View className="w-full gap-layout-xsmall">
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
                      size={24}
                      tintColor={ds.colors.icon.default}
                    />
                  </Pressable>
                )}
              </View>
              {subtitle ? (
                <Text className="font-paragraph text-paragraph font-default text-text-subtle">
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {scroll ? (
              <ScrollView
                ref={scrollRef}
                style={{ flexShrink: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <BottomSheetScrollContext.Provider value={scrollRef}>
                  <View className="w-full gap-layout-small">{children}</View>
                </BottomSheetScrollContext.Provider>
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
