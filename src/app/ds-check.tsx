// Throwaway verification screen for the DS token wiring. Reachable at
// /ds-check. Delete once the tokens are confirmed working. Every class below
// comes from the Sebell DS Prep+Eat theme fragment.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Chip } from '@/components/ui/chip';

export default function DsCheck() {
  const [picked, setPicked] = useState<string[]>(['Veggie']);
  const toggle = (tag: string) =>
    setPicked((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]));
  return (
    <ScrollView
      className="flex-1 bg-surface-primary"
      contentContainerClassName="gap-layout-medium p-comp-small">
      {/* Green surface + mocha text + Montserrat weights */}
      <View className="gap-comp-small rounded-medium bg-surface-neutral-white p-comp-small">
        <Text className="font-header text-display-5 font-emphasized text-text-default">
          Prep+Eat tokens
        </Text>
        <Text className="font-header text-paragraph font-emphasized text-text-default">
          font-emphasized · 700
        </Text>
        <Text className="font-header text-paragraph font-default text-text-default">
          font-default · 400
        </Text>
        <Text className="font-header text-paragraph font-understate text-text-default">
          font-understate · 200
        </Text>
      </View>

      {/* Display scale on the green surface */}
      <Text className="font-header text-display-1 font-emphasized text-text-inverse">Aa</Text>

      {/* Chip rows – solid and outline, tap to toggle active */}
      <View className="gap-comp-small rounded-medium bg-surface-neutral-white p-comp-small">
        <View className="flex-row flex-wrap gap-comp-small">
          {['Veggie', 'Quick', 'Kids'].map((tag) => (
            <Chip key={tag} label={tag} active={picked.includes(tag)} onPress={() => toggle(tag)} />
          ))}
          <Chip label="Disabled" disabled />
        </View>
        <View className="flex-row flex-wrap gap-comp-small">
          {['Veggie', 'Quick', 'Kids'].map((tag) => (
            <Chip
              key={tag}
              label={tag}
              variant="outline"
              startIcon={picked.includes(tag) ? 'check' : undefined}
              active={picked.includes(tag)}
              onPress={() => toggle(tag)}
            />
          ))}
        </View>
      </View>

      {/* Error color + radius + component padding */}
      <View className="rounded-medium bg-error p-comp-small">
        <Text className="font-header text-paragraph font-default text-text-inverse">
          bg-error · rounded-medium · p-comp-small
        </Text>
      </View>
    </ScrollView>
  );
}
