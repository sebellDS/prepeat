import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ServingsCounter } from "@/components/recipes/servings-counter";
import { BottomSheet } from "@/components/ui/bottom-sheet";

/**
 * Swipe action "servings" (Figma "Change servings" 147:27195). The linked
 * shopping list rescales automatically per A + rails – clean lines only.
 */
export function ServingsSheet({
  visible,
  initialServings,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  initialServings: number;
  onClose: () => void;
  onSubmit: (servings: number) => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      title="Change servings"
      subtitle="Having friends over?"
      onClose={onClose}
    >
      {visible && (
        <SheetContent
          initialServings={initialServings}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </BottomSheet>
  );
}

function SheetContent({
  initialServings,
  onClose,
  onSubmit,
}: {
  initialServings: number;
  onClose: () => void;
  onSubmit: (servings: number) => void;
}) {
  const [servings, setServings] = useState(initialServings);
  return (
    <View className="w-full gap-layout-small">
      <ServingsCounter value={servings} onChange={setServings} />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onSubmit(servings);
          onClose();
        }}
        className="w-full items-center rounded-medium bg-button-solid-fill-enabled py-comp-large"
      >
        <Text className="font-paragraph text-components-button-label font-default text-button-solid-label-enabled">
          Change servings
        </Text>
      </Pressable>
    </View>
  );
}
