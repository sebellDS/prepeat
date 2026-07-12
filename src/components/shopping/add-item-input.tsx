import { useState } from 'react';
import { View } from 'react-native';

import { Input } from '@/components/ui/input';

interface AddItemInputProps {
  onSubmit: (name: string) => void;
}

export function AddItemInput({ onSubmit }: AddItemInputProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const name = value.trim();
    if (name) {
      onSubmit(name);
    }
    setValue('');
  };

  return (
    <View className="w-full px-layout-small pb-layout-small">
      <Input
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        // Families add several items in a row: keep the keyboard up.
        submitBehavior="submit"
        returnKeyType="done"
        placeholder="Add an item"
        accessibilityLabel="Add an item"
      />
    </View>
  );
}
