// Functional onboarding flow: welcome → email → code → name → household
// choice → create/join. Deliberately plain screens using DS tokens – the
// visual design lands in Figma and gets applied on top; the flow logic,
// error handling and waiting states live here and stay.
import type { Session } from '@supabase/supabase-js';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
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
        <View className="flex-1 items-center justify-center gap-layout-xsmall">
          <Wordmark large />
          <Text className="text-center font-paragraph text-paragraph font-default text-text-subtle">
            Plan dinners, collect recipes, and shop together.
          </Text>
        </View>
        <PrimaryButton label="Get started" onPress={() => setStep({ kind: 'email' })} />
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
        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoFocus
          />
        </Field>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Check your email"
      subtitle={`We sent a code to ${step.email}.`}
      onBack={() => setStep({ kind: 'email' })}
      submitLabel="Continue"
      onSubmit={() => verifyCode(step.email, code)}
      canSubmit={code.trim().length >= 6}
      footer={
        <TextButton
          label="Send a new code"
          onPress={() => requestCode(step.email)}
        />
      }>
      <Field label="Code">
        <Input
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={10}
          autoFocus
        />
      </Field>
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
      <Field label="First name">
        <Input value={name} onChangeText={setName} placeholder="Your first name" autoFocus />
      </Field>
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
        <View className="flex-1 justify-center gap-layout-small">
          <Text className="font-header text-display-5 font-emphasized text-text-default">
            Set up your household
          </Text>
          <Text className="font-paragraph text-paragraph font-default text-text-subtle">
            The shared space where your family plans meals and shops together.
          </Text>
          <ChoiceCard
            title="Start a household"
            body="Create a new shared space and invite your family."
            onPress={() => setStep({ kind: 'create' })}
          />
          <ChoiceCard
            title="Join with a code"
            body="Someone in your family already has Prep+Eat? Enter their invite code."
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
          <View className="flex-1 justify-center gap-layout-small">
            <Text className="font-header text-display-5 font-emphasized text-text-default">
              {created.household.name} is ready
            </Text>
            <Text className="font-paragraph text-paragraph font-default text-text-subtle">
              Share this code with your family so they can join:
            </Text>
            <View className="items-center rounded-large bg-surface-neutral-white p-layout-small">
              <Text className="font-header text-display-5 font-emphasized text-text-default">
                {created.inviteCode}
              </Text>
            </View>
            <TextButton
              label="Share the code"
              onPress={() =>
                Share.share({
                  message: `Join our household "${created.household.name}" in Prep+Eat with the code ${created.inviteCode}`,
                })
              }
            />
          </View>
          <PrimaryButton label="Start planning" onPress={() => onHouseholdReady(created.household)} />
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
        <Field label="Household name">
          <Input value={name} onChangeText={setName} placeholder="e.g. The Sebell Kitchen" autoFocus />
        </Field>
      </FormScreen>
    );
  }

  if (joined) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-layout-xsmall">
          <Text className="font-header text-display-5 font-emphasized text-text-default">
            Welcome to {joined.name}
          </Text>
          <Text className="text-center font-paragraph text-paragraph font-default text-text-subtle">
            {"You're in – the family's plans and shopping list are now yours too."}
          </Text>
        </View>
        <PrimaryButton label="Start planning" onPress={() => onHouseholdReady(joined)} />
      </Screen>
    );
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
      <Field label="Invite code">
        <Input
          value={code}
          onChangeText={setCode}
          placeholder="PREP-7X4K"
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
        />
      </Field>
    </FormScreen>
  );
}

// ── Building blocks (plain, DS-tokened, replaced by Figma designs later) ──

function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-surface-neutral-lighter">
      <View className="flex-1 p-layout-small pb-layout-medium">{children}</View>
    </SafeAreaView>
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
  children: ReactNode;
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
        <View className="flex-1 gap-layout-small pt-layout-large">
          {onBack != null && <TextButton label="← Back" onPress={onBack} align="left" />}
          <Text className="font-header text-display-5 font-emphasized text-text-default">
            {title}
          </Text>
          <Text className="font-paragraph text-paragraph font-default text-text-subtle">
            {subtitle}
          </Text>
          {children}
          {error != null && (
            <Text className="font-paragraph text-small font-default text-text-danger">{error}</Text>
          )}
          {footer}
        </View>
        <PrimaryButton label={submitLabel} onPress={submit} disabled={!canSubmit} busy={busy} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ChoiceCard({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="w-full gap-comp-xsmall rounded-large border border-border bg-surface-neutral-white p-layout-small">
      <Text className="font-paragraph text-paragraph font-emphasized text-text-default">
        {title}
      </Text>
      <Text className="font-paragraph text-small font-default text-text-subtle">{body}</Text>
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="w-full gap-comp-xsmall">
      <Text className="font-paragraph text-small font-default text-text-subtle">{label}</Text>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={ds.colors.text.disabled}
      {...props}
      className="w-full rounded-small border border-border bg-surface-neutral-white p-comp-large font-paragraph text-paragraph text-text-default"
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
        'w-full items-center rounded-small py-comp-large ' +
        (disabled ? 'bg-surface-neutral-main' : 'bg-surface-primary-main')
      }>
      {busy ? (
        <ActivityIndicator color={ds.colors.text.default} />
      ) : (
        <Text className="font-paragraph text-components-button-label font-emphasized text-text-default">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function TextButton({
  label,
  onPress,
  align = 'center',
}: {
  label: string;
  onPress: () => void;
  align?: 'left' | 'center';
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text
        className={
          'font-paragraph text-paragraph font-default text-success-darker ' +
          (align === 'center' ? 'text-center' : '')
        }>
        {label}
      </Text>
    </Pressable>
  );
}

function Wordmark({ large }: { large?: boolean }) {
  const size = large ? 'text-display-4' : 'text-display-5';
  return (
    <View className="flex-row">
      <Text className={`font-header ${size} font-emphasized text-text-default`}>PREP</Text>
      <Text className={`font-header ${size} font-emphasized text-text-brand`}>+</Text>
      <Text className={`font-header ${size} font-emphasized text-text-default`}>EAT</Text>
    </View>
  );
}
