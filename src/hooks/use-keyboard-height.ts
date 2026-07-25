import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Height of the on-screen keyboard, 0 when it is down. iOS gets the "will"
 * events so layout moves with the keyboard animation rather than after it.
 *
 * Used by anything that must stay visible above the keyboard – the add-meal
 * sheet's content, and the undo toast (which otherwise renders behind the
 * keyboard and looks like it never appeared; Thomas, 2026-07-25).
 */
export function useKeyboardHeight(): number {
  // Seed from the CURRENT keyboard state: the show/hide events only fire on
  // transitions, so anything mounted while the keyboard is already up (the
  // undo toast, which appears after you have been typing) would otherwise
  // believe it is down and render behind it (Thomas, 2026-07-25).
  const [keyboardHeight, setKeyboardHeight] = useState(
    () => Keyboard.metrics()?.height ?? 0,
  );
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return keyboardHeight;
}
