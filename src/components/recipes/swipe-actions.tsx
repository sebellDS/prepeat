import { MaterialIcons } from "@expo/vector-icons";
import { useRef } from "react";
import { Pressable, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { ds } from "@/constants/ds";

/**
 * Swipe-left edit/delete actions – the same interaction as the shopping
 * list rows, shared by recipe ingredient and instruction rows everywhere.
 */
export function SwipeActions({
  onEdit,
  onDelete,
  children,
  label,
}: {
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
  label: string;
}) {
  const swipeable = useRef<SwipeableMethods>(null);
  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${label}`}
            onPress={() => {
              swipeable.current?.close();
              onEdit();
            }}
            className="w-[56px] items-center justify-center bg-surface-neutral-light"
          >
            <MaterialIcons
              name="edit-note"
              size={24}
              color={ds.colors.icon.default}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${label}`}
            onPress={() => {
              swipeable.current?.close();
              onDelete();
            }}
            className="w-[56px] items-center justify-center bg-error"
          >
            <MaterialIcons
              name="delete"
              size={20}
              color={ds.colors.text.inverse}
            />
          </Pressable>
        </View>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
