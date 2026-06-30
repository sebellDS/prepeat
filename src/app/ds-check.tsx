// Throwaway verification screen for the DS token wiring. Reachable at
// /ds-check. Delete once the tokens are confirmed working. Every class below
// comes from the Sebell DS Prep+Eat theme fragment.
import { ScrollView, Text, View } from 'react-native';

export default function DsCheck() {
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

      {/* Error color + radius + component padding */}
      <View className="rounded-medium bg-error p-comp-small">
        <Text className="font-header text-paragraph font-default text-text-inverse">
          bg-error · rounded-medium · p-comp-small
        </Text>
      </View>
    </ScrollView>
  );
}
