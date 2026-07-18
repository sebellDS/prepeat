import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { ds } from '@/constants/ds';

// One source for the field's state styling so Input and ClearableInput
// cannot drift apart (the reason this file exists).
function fieldClasses(focused: boolean, hasError?: boolean): string {
  return hasError
    ? 'border-2 border-forms-border-error bg-forms-background-default'
    : focused
      ? 'border-2 border-forms-border-focused bg-forms-background-active'
      : 'border border-forms-border-enabled bg-forms-background-default';
}

/**
 * The DS input component (forms/* tokens): quiet grey field that turns
 * white with a 2px lime border while focused; errors turn the border red.
 * Shared by onboarding, the shopping add-field and the edit-item sheet so
 * the active state can never drift apart again.
 */
export function Input({
  hasError,
  onFocus,
  onBlur,
  ref,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  hasError?: boolean;
  ref?: React.Ref<TextInput>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={ds.colors.text.disabled}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      className={
        'w-full rounded-medium p-comp-large font-paragraph text-paragraph text-text-default ' +
        fieldClasses(focused, hasError)
      }
    />
  );
}

/**
 * The DS input with the trailing clear "X" (Figma clearable input, first
 * used on the Household sheets 2026-07-18). Same tokens and states as
 * Input; the border lives on the wrapping row so the icon sits inside.
 */
export function ClearableInput({
  value,
  onChangeText,
  hasError,
  onFocus,
  onBlur,
  ...props
}: React.ComponentProps<typeof TextInput> & { hasError?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      className={
        'w-full flex-row items-center gap-comp-small rounded-medium p-comp-large ' +
        fieldClasses(focused, hasError)
      }
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={ds.colors.text.disabled}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className="flex-1 p-0 font-paragraph text-paragraph text-text-default"
      />
      {value != null && value.length > 0 && (
        <Pressable
          onPress={() => onChangeText?.('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear"
        >
          <MaterialIcons name="close" size={24} color={ds.colors.icon.default} />
        </Pressable>
      )}
    </View>
  );
}
