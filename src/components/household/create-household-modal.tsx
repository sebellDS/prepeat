// Create a new household from the switcher ("Create a new household" menu item,
// Figma "change household", 2026-07-30). Mirrors JoinHouseholdModal: a
// full-screen modal name form, then the welcome screen (reused), inside a modal
// so the flow stays within HouseholdProvider – the switcher's addHousehold
// makes the new household active. The name-form UI reuses the
// JoinHouseholdModal / onboarding "Name your household" pattern; there is no
// dedicated Figma frame for the form itself (only the menu item).
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { WelcomeScreen } from '@/components/onboarding/onboarding-flow';
import { Input } from '@/components/ui/input';
import { ds } from '@/constants/ds';
import { friendlyError } from '@/lib/error-messages';
import { createHousehold, type Household } from '@/lib/household';

export function CreateHouseholdModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (household: Household) => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the household is created – swaps the form for the welcome screen
  // before the switcher makes it active.
  const [created, setCreated] = useState<Household | null>(null);

  const reset = () => {
    setName('');
    setBusy(false);
    setError(null);
    setCreated(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await createHousehold(name.trim());
      setBusy(false);
      setCreated(result.household);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  const canSubmit = name.trim().length > 0 && !busy;

  if (created != null) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={close}>
        {/* A SafeAreaView inside a Modal gets no insets (the Modal renders
            outside the provider tree), so re-establish the provider here. */}
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <WelcomeScreen
            household={created}
            buttonLabel="Take a look around your new household"
            onContinue={() => {
              const result = created;
              reset();
              onCreated(result);
            }}
          />
        </SafeAreaProvider>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-neutral-lightest">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1">
            <View className="w-full flex-row items-center px-layout-small pb-layout-medium pt-layout-xsmall">
              <Pressable
                onPress={close}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Back">
                <MaterialIcons name="arrow-back" size={28} color={ds.colors.surface.primary.main} />
              </Pressable>
            </View>
            <View className="flex-1 px-layout-small">
              <View className="w-full gap-layout-small rounded-large bg-surface-neutral-white px-layout-small pb-layout-small pt-layout-large">
                <View className="w-full gap-layout-small">
                  <Text className="font-header text-display-5 font-emphasized leading-small text-text-subtle">
                    Name your household
                  </Text>
                  <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
                    Pick something your family will recognise.
                  </Text>
                </View>
                <View className="w-full gap-layout-xsmall">
                  <Text className="font-paragraph text-components-label font-default leading-xxsmall text-text-default">
                    Household name
                  </Text>
                  {error != null && (
                    <View className="w-full flex-row items-start gap-comp-large rounded-medium bg-error-lightest px-comp-large py-comp-small">
                      <Text className="flex-1 font-paragraph text-paragraph font-default leading-xsmall text-text-default">
                        {error}
                      </Text>
                      <MaterialIcons name="error-outline" size={24} color={ds.colors.icon.default} />
                    </View>
                  )}
                  <Input
                    value={name}
                    onChangeText={setName}
                    placeholder="The Hanson Kitchen"
                    autoFocus
                    hasError={error != null}
                  />
                </View>
              </View>
            </View>
            <View className="w-full px-layout-small pb-layout-medium">
              <Pressable
                accessibilityRole="button"
                onPress={submit}
                disabled={!canSubmit}
                className={
                  'w-full items-center rounded-medium px-comp-xlarge py-comp-large ' +
                  (canSubmit ? 'bg-button-solid-fill-enabled' : 'bg-surface-neutral-light')
                }>
                {busy ? (
                  <ActivityIndicator color={ds.colors.button.solid.label.enabled} />
                ) : (
                  <Text className="font-paragraph text-paragraph font-default leading-xsmall text-button-solid-label-enabled">
                    Create household
                  </Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
