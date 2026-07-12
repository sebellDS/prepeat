import { useEffect, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { fetchMyHousehold, getOrCreateInvite, type Household } from '@/lib/household';

// Minimal functional Household screen until the tab is designed: shows the
// household, invites, and the sign-out control agreed in the auth decision
// (sessions never expire on a schedule; leaving is always user-initiated).
export default function HouseholdScreen() {
  const { session, firstName, signOut } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyHousehold()
      .then(setHousehold)
      .catch(() => setHousehold(null));
  }, []);

  const invite = async () => {
    if (!household) return;
    setError(null);
    try {
      const code = inviteCode ?? (await getOrCreateInvite(household.id));
      setInviteCode(code);
      await Share.share({
        message: `Join our household "${household.name}" in Prep+Eat with the code ${code}`,
      });
    } catch {
      setError('Could not create an invite code – are you online?');
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-neutral-lightest">
      <View className="w-full px-layout-small pb-layout-small">
        <Text className="font-header text-display-4 font-emphasized leading-medium text-text-default">
          Household
        </Text>
      </View>
      <View className="flex-1 gap-layout-small px-layout-small">
        <View className="w-full gap-comp-xsmall rounded-large bg-surface-neutral-white p-layout-small">
          <Text className="font-paragraph text-small font-default text-text-subtle">
            Your household
          </Text>
          <Text className="font-paragraph text-paragraph font-emphasized text-text-default">
            {household?.name ?? '…'}
          </Text>
          <Text className="font-paragraph text-small font-default text-text-subtle">
            Signed in as {firstName ?? '…'} ({session?.user?.email ?? ''})
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={invite}
          className="w-full items-center rounded-medium bg-button-solid-fill-enabled py-comp-large">
          <Text className="font-paragraph text-components-button-label font-default text-text-default">
            Invite a family member
          </Text>
        </Pressable>
        {inviteCode != null && (
          <Text className="text-center font-paragraph text-paragraph font-emphasized text-text-default">
            Invite code: {inviteCode}
          </Text>
        )}
        {error != null && (
          <Text className="font-paragraph text-small font-default text-text-danger">{error}</Text>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          className="w-full items-center rounded-medium border border-border py-comp-large">
          <Text className="font-paragraph text-components-button-label font-default text-text-subtle">
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
