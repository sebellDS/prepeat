import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { ds } from '@/constants/ds';

interface AddItemInputProps {
  onSubmit: (name: string) => void;
}

export function AddItemInput({ onSubmit }: AddItemInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const submit = () => {
    const name = value.trim();
    if (name) {
      onSubmit(name);
    }
    setValue('');
  };

  return (
    <View className="w-full px-layout-small pb-layout-small">
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        // Families add several items in a row: keep the keyboard up.
        submitBehavior="submit"
        returnKeyType="done"
        placeholder="Add an item"
        placeholderTextColor={ds.colors.text.subtle}
        accessibilityLabel="Add an item"
        className="w-full rounded-small border border-border bg-surface-neutral-lighter p-comp-large font-paragraph text-paragraph text-text-default"
      />
    </View>
  );
}
