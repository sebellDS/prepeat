// Onboarding flow, skinned from the Figma sign-up designs (login page:
// signin / household set up / join a household sections). Flow logic and
// error/waiting states predate the skin; visuals follow the frames.
import { MaterialIcons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ds } from '@/constants/ds';
import { useAuth } from '@/lib/auth';
import {
  createHousehold,
  joinHousehold,
  type Household,
} from '@/lib/household';

const welcomePhoto = require('../../../assets/images/onboarding/welcome-macarons.jpg');

interface OnboardingFlowProps {
  session: Session | null;
  firstName: string | null;
  onHouseholdReady: (household: Household) => void;
}

type AuthStep = { kind: 'welcome' } | { kind: 'email' } | { kind: 'code'; email: string };
type HouseholdStep = { kind: 'choice' } | { kind: 'create' } | { kind: 'join' };

export function OnboardingFlow({ session, firstName, onHouseholdReady }: OnboardingFlowProps) {
  // Signed out: the auth steps. Signed in: name, then household setup –
  // which also makes onboarding resume in the right place on a fresh launch.
  if (session == null) {
    return <AuthSteps />;
  }
  if (firstName == null) {
    return <NameStep />;
  }
  return <HouseholdSteps onHouseholdReady={onHouseholdReady} />;
}

function AuthSteps() {
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<AuthStep>({ kind: 'welcome' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  if (step.kind === 'welcome') {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-layout-small">
          <Wordmark size="large" />
          <Text className="text-center font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
            Plan dinners, collect recipes and shop together – as a family
          </Text>
        </View>
        <View className="w-full px-layout-small pb-layout-medium">
          <PrimaryButton label="Get started" onPress={() => setStep({ kind: 'email' })} />
        </View>
      </Screen>
    );
  }

  if (step.kind === 'email') {
    return (
      <FormScreen
        title="What's your email?"
        subtitle="We'll send you a sign-in code – no password to remember."
        onBack={() => setStep({ kind: 'welcome' })}
        submitLabel="Send code"
        onSubmit={async () => {
          await requestCode(email);
          setCode('');
          setStep({ kind: 'code', email });
        }}
        canSubmit={/.+@.+\..+/.test(email.trim())}>
        {(error) => (
          <Field label="Email" error={error}>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
              hasError={error != null}
            />
          </Field>
        )}
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Check your email"
      subtitle={`We sent a code to ${step.email}. Can't find it? Check your spam folder.`}
      onBack={() => setStep({ kind: 'email' })}
      submitLabel="Continue"
      onSubmit={() => verifyCode(step.email, code)}
      canSubmit={code.trim().length >= 6}
      footer={<LinkButton label="Send a new code" onPress={() => requestCode(step.email)} />}>
      {(error) => (
        <Field label="Code" error={error}>
          <Input
            value={code}
            onChangeText={setCode}
            placeholder="12345678"
            keyboardType="number-pad"
            maxLength={10}
            autoFocus
            hasError={error != null}
          />
        </Field>
      )}
    </FormScreen>
  );
}

function NameStep() {
  const { saveFirstName } = useAuth();
  const [name, setName] = useState('');
  return (
    <FormScreen
      title="What's your first name?"
      subtitle="Shown to your family when you check things off the list."
      submitLabel="Continue"
      onSubmit={() => saveFirstName(name)}
      canSubmit={name.trim().length > 0}>
      {(error) => (
        <Field label="First name" error={error}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Thomas"
            autoFocus
            hasError={error != null}
          />
        </Field>
      )}
    </FormScreen>
  );
}

function HouseholdSteps({ onHouseholdReady }: { onHouseholdReady: (h: Household) => void }) {
  const [step, setStep] = useState<HouseholdStep>({ kind: 'choice' });
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [created, setCreated] = useState<{ household: Household; inviteCode: string } | null>(null);
  const [joined, setJoined] = useState<Household | null>(null);

  if (step.kind === 'choice') {
    return (
      <Screen>
        <TopBar />
        <View className="w-full gap-layout-small px-layout-small pb-layout-medium">
          <Text className="font-header text-display-5 font-emphasized leading-small text-text-subtle">
            Set up your household
          </Text>
          <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
            The shared space where your family plans meals and shops together.
          </Text>
        </View>
        <View className="w-full gap-layout-small px-layout-small">
          <ChoiceCard
            icon="add-home"
            title="Start a household"
            body="If you're the first one here, start your family's shared space – you'll get a code to invite the others."
            onPress={() => setStep({ kind: 'create' })}
          />
          <ChoiceCard
            icon="card-membership"
            title="Join with a code"
            body="Got a code from your family? Join them here."
            onPress={() => setStep({ kind: 'join' })}
          />
        </View>
      </Screen>
    );
  }

  if (step.kind === 'create') {
    if (created) {
      return (
        <Screen>
          <TopBar />
          <View className="w-full gap-layout-small px-layout-small pb-layout-medium">
            <Text className="font-header text-display-5 font-emphasized leading-small text-text-subtle">
              {created.household.name} is ready
            </Text>
            <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
              Share this code so your family can join.
            </Text>
          </View>
          <View className="w-full gap-layout-small px-layout-small">
            <View className="w-full flex-row items-center rounded-large bg-surface-neutral-white p-layout-small">
              <Text className="flex-1 text-center font-header text-display-5 font-emphasized leading-small text-text-default">
                {created.inviteCode}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share the code"
                hitSlop={8}
                onPress={() => shareInvite(created.household.name, created.inviteCode)}>
                <MaterialIcons name="content-copy" size={24} color={ds.colors.icon.default} />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => shareInvite(created.household.name, created.inviteCode)}
              className="w-full items-center rounded-medium bg-surface-neutral-white py-comp-large">
              <Text className="font-paragraph text-paragraph font-default text-text-default">
                Share the code
              </Text>
            </Pressable>
          </View>
          <View className="w-full flex-1 justify-end px-layout-small pb-layout-medium">
            <PrimaryButton
              label="Start planning"
              onPress={() => onHouseholdReady(created.household)}
            />
          </View>
        </Screen>
      );
    }
    return (
      <FormScreen
        title="Name your household"
        subtitle="Pick something your family will recognise."
        onBack={() => setStep({ kind: 'choice' })}
        submitLabel="Create household"
        onSubmit={async () => {
          setCreated(await createHousehold(name));
        }}
        canSubmit={name.trim().length > 0}>
        {(error) => (
          <Field label="Household name" error={error}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="The Hanson Kitchen"
              autoFocus
              hasError={error != null}
            />
          </Field>
        )}
      </FormScreen>
    );
  }

  if (joined) {
    return <WelcomeScreen household={joined} onContinue={() => onHouseholdReady(joined)} />;
  }

  return (
    <FormScreen
      title="Enter your invite code"
      subtitle="Get it from the family member who set up Prep+Eat."
      onBack={() => setStep({ kind: 'choice' })}
      submitLabel="Join household"
      onSubmit={async () => {
        setJoined(await joinHousehold(code));
      }}
      canSubmit={code.trim().length >= 4}>
      {(error) => (
        <Field label="Invite code" error={error}>
          <Input
            value={code}
            onChangeText={setCode}
            placeholder="PREP-XXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            hasError={error != null}
          />
        </Field>
      )}
    </FormScreen>
  );
}

function WelcomeScreen({ household, onContinue }: { household: Household; onContinue: () => void }) {
  return (
    <ImageBackground source={welcomePhoto} resizeMode="cover" className="flex-1">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="h-[300px] w-full items-center justify-center gap-layout-small px-layout-small">
          <Text className="text-center font-header text-display-4 font-emphasized leading-medium text-text-subtle">
            Welcome to {household.name}
          </Text>
          <View className="flex-row">
            <WordmarkPart text="prep" />
            <WordmarkPlus />
            <WordmarkPart text="eat" />
            <WordmarkPlus />
            <WordmarkPart text="repeat" />
          </View>
        </View>
        <View className="w-full flex-1 justify-end px-layout-small pb-layout-medium">
          <PrimaryButton label="Start planning" onPress={onContinue} />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

async function shareInvite(householdName: string, inviteCode: string) {
  try {
    await Share.share({
      message: `Join our household "${householdName}" in Prep+Eat with the code ${inviteCode}`,
    });
  } catch {
    // Sharing was dismissed – nothing to handle.
  }
}

// ── Building blocks from the design system ──────────────────────────────

function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-neutral-lighter">
      {children}
    </SafeAreaView>
  );
}

function TopBar({ onBack }: { onBack?: () => void }) {
  return (
    <View className="mb-layout-xlarge w-full flex-row items-center justify-center px-layout-small pt-layout-xsmall">
      {onBack != null && (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="absolute bottom-0 left-layout-small">
          <MaterialIcons name="arrow-back" size={28} color={ds.colors.surface.primary.main} />
        </Pressable>
      )}
      <Wordmark size="small" />
    </View>
  );
}

function WordmarkPart({ text, large }: { text: string; large?: boolean }) {
  return (
    <Text
      className={
        'font-header font-emphasized text-text-subtle ' +
        (large ? 'text-display-4 leading-medium' : 'text-display-5 leading-small')
      }>
      {text}
    </Text>
  );
}

function WordmarkPlus({ large }: { large?: boolean }) {
  return (
    <Text
      className={
        'font-header font-emphasized text-success-dark ' +
        (large ? 'text-display-4 leading-medium' : 'text-display-5 leading-small')
      }>
      +
    </Text>
  );
}

function Wordmark({ size }: { size: 'small' | 'large' }) {
  const large = size === 'large';
  return (
    <View className="flex-row">
      <WordmarkPart text="prep" large={large} />
      <WordmarkPlus large={large} />
      <WordmarkPart text="eat" large={large} />
    </View>
  );
}

interface FormScreenProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  onSubmit: () => Promise<unknown> | void;
  canSubmit: boolean;
  onBack?: () => void;
  footer?: ReactNode;
  children: (error: string | null) => ReactNode;
}

function FormScreen({
  title,
  subtitle,
  submitLabel,
  onSubmit,
  canSubmit,
  onBack,
  footer,
  children,
}: FormScreenProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err != null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Something went wrong – please try again';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <TopBar onBack={onBack} />
        <View className="w-full gap-layout-small px-layout-small pb-layout-medium">
          <Text className="font-header text-display-5 font-emphasized leading-small text-text-subtle">
            {title}
          </Text>
          <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
            {subtitle}
          </Text>
        </View>
        <View className="w-full gap-layout-small px-layout-small">
          {children(error)}
          {footer}
        </View>
        <View className="w-full flex-1 justify-end px-layout-small pb-layout-medium">
          <PrimaryButton label={submitLabel} onPress={submit} disabled={!canSubmit} busy={busy} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View className="w-full gap-layout-xsmall">
      <Text className="font-paragraph text-components-label font-default leading-xxsmall text-text-default">
        {label}
      </Text>
      {error != null && (
        <View className="w-full flex-row items-start gap-comp-large rounded-medium bg-error-lighter px-comp-large py-comp-small">
          <Text className="flex-1 font-paragraph text-paragraph font-default leading-xsmall text-text-default">
            {error}
          </Text>
          <MaterialIcons name="error-outline" size={24} color={ds.colors.icon.default} />
        </View>
      )}
      {children}
    </View>
  );
}

function Input({ hasError, ...props }: React.ComponentProps<typeof TextInput> & { hasError?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={ds.colors.text.disabled}
      {...props}
      className={
        'w-full rounded-medium bg-surface-neutral-lighter p-comp-large font-paragraph text-paragraph text-text-default ' +
        (hasError ? 'border-2 border-error' : 'border border-border')
      }
    />
  );
}

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}

function PrimaryButton({ label, onPress, disabled, busy }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      className={
        'w-full items-center rounded-medium px-comp-xlarge py-comp-large ' +
        (disabled ? 'bg-surface-neutral-main' : 'bg-surface-primary-main')
      }>
      {busy ? (
        <ActivityIndicator color={ds.colors.text.inverse} />
      ) : (
        <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-inverse">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      className="self-start border-b-2 border-surface-primary-main pb-[2px]">
      <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
        {label}
      </Text>
    </Pressable>
  );
}

function ChoiceCard({
  icon,
  title,
  body,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="w-full flex-row gap-comp-large rounded-large bg-surface-neutral-white p-layout-small">
      <MaterialIcons name={icon} size={48} color={ds.colors.surface.primary.main} />
      <View className="min-w-0 flex-1 gap-comp-small">
        <Text className="font-paragraph text-paragraph font-emphasized leading-xsmall text-text-default">
          {title}
        </Text>
        <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
          {body}
        </Text>
      </View>
    </Pressable>
  );
}
