import { useState } from 'react';
import { TextInput } from 'react-native';

import { ds } from '@/constants/ds';

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
  ...props
}: React.ComponentProps<typeof TextInput> & { hasError?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
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
        (hasError
          ? 'border-2 border-forms-border-error bg-forms-background-default'
          : focused
            ? 'border-2 border-forms-border-focused bg-forms-background-active'
            : 'border border-forms-border-enabled bg-forms-background-default')
      }
    />
  );
}
