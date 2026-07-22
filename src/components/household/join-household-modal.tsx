// Join another household from the switcher (Figma "join household", 2026-07-22).
// Reuses the onboarding invite-code screen, then the welcome screen (Figma
// "join a household 4"), inside a full-screen modal so the flow stays inside
// HouseholdProvider – the switcher's addHousehold makes the joined household
// active. Built on the app's current tokens.
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { WelcomeScreen } from '@/components/onboarding/onboarding-flow';
import { Input } from '@/components/ui/input';
import { ds } from '@/constants/ds';
import { joinHousehold, type Household } from '@/lib/household';

export function JoinHouseholdModal({
  visible,
  onClose,
  onJoined,
}: {
  visible: boolean;
  onClose: () => void;
  onJoined: (household: Household) => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the code is redeemed – swaps the form for the welcome screen
  // before the switcher makes the household active.
  const [joined, setJoined] = useState<Household | null>(null);

  const reset = () => {
    setCode('');
    setBusy(false);
    setError(null);
    setJoined(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await joinHousehold(code.trim());
      setBusy(false);
      setJoined(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong – please try again';
      setError(message);
      setBusy(false);
    }
  };

  const canSubmit = code.trim().length >= 4 && !busy;

  if (joined != null) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={close}>
        <WelcomeScreen
          household={joined}
          buttonLabel="Take a look around your new household"
          onContinue={() => {
            const result = joined;
            reset();
            onJoined(result);
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
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
                  Enter your invite code
                </Text>
                <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
                  Get it from the family member who set up Prep+Eat.
                </Text>
              </View>
              <View className="w-full gap-layout-xsmall">
                <Text className="font-paragraph text-components-label font-default leading-xxsmall text-text-default">
                  Invite code
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
                  value={code}
                  onChangeText={setCode}
                  placeholder="PREP-XXXX"
                  autoCapitalize="characters"
                  autoCorrect={false}
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
                  Join household
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
