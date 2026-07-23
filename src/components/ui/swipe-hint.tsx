import { MaterialIcons } from "@expo/vector-icons";
import { createContext, useContext } from "react";
import { Pressable } from "react-native";

import { ds } from "@/constants/ds";

/**
 * Lets a swipeable row hand its "open the actions" function down to the
 * SwipeHint inside it, without every row having to thread a prop through
 * its content. Rows that don't provide it render the hint as plain
 * decoration.
 */
const SwipeRowContext = createContext<(() => void) | null>(null);

export function SwipeRowProvider({
  open,
  children,
}: {
  open: () => void;
  children: React.ReactNode;
}) {
  return (
    <SwipeRowContext.Provider value={open}>{children}</SwipeRowContext.Provider>
  );
}

/**
 * The trailing affordance on every row whose actions open with a left
 * swipe (Figma recipe row 147:24404, the `more_vert` at the row end).
 *
 * A swipe is invisible until you already know it is there – this is the
 * hint for everyone who doesn't (Thomas, 2026-07-23). Tapping it slides
 * the row open, so the icon isn't just a label for a gesture you still
 * have to guess at: it's a way to reach the actions without swiping at
 * all (Thomas, 2026-07-23).
 *
 * Nested inside the row's own Pressable on purpose – React Native gives
 * the touch to the innermost pressable, so tapping the dots opens the
 * actions instead of firing the row's own press.
 */
export function SwipeHint() {
  const open = useContext(SwipeRowContext);
  const icon = (
    <MaterialIcons name="more-vert" size={24} color={ds.colors.icon.default} />
  );

  if (open == null) {
    return icon;
  }

  return (
    <Pressable
      onPress={open}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Show actions"
    >
      {icon}
    </Pressable>
  );
}
