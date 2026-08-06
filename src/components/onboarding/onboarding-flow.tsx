// Onboarding flow, skinned from the Figma sign-up designs (login page:
// signin / household set up / join a household sections). Flow logic and
// error/waiting states predate the skin; visuals follow the frames.
import { MaterialIcons } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/input';
import { ds } from '@/constants/ds';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/error-messages';
import {
  createHousehold,
  joinHousehold,
  type Household,
} from '@/lib/household';

const welcomePhoto = require('../../../assets/images/onboarding/welcome-green-macarons.jpg');
const splashPhoto = require('../../../assets/images/onboarding/splash.jpg');
const bottomScrim = require('../../../assets/images/onboarding/scrim-bottom.png');

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
      <ImageBackground source={splashPhoto} resizeMode="cover" className="flex-1">
        <Image
          source={bottomScrim}
          resizeMode="stretch"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%', width: '100%' }}
        />
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 px-layout-small">
          <View className="h-[370px] w-full items-center justify-center gap-layout-small">
            <View className="flex-row">
              {/* 48px is the splash-only wordmark size; inline to match the design exactly. */}
              <Text
                className="font-header font-emphasized text-text-subtle"
                style={{ fontSize: 48, lineHeight: 48 }}>
                prep
              </Text>
              <Text
                className="font-header font-emphasized text-success-dark"
                style={{ fontSize: 48, lineHeight: 48 }}>
                +
              </Text>
              <Text
                className="font-header font-emphasized text-text-subtle"
                style={{ fontSize: 48, lineHeight: 48 }}>
                eat
              </Text>
            </View>
            <Text className="text-center font-paragraph text-paragraph font-default leading-xsmall text-text-default">
              Plan dinners, collect recipes{'\n'}and shop together – as a family
            </Text>
          </View>
          <View className="w-full flex-1 items-center justify-end gap-layout-small pb-layout-xsmall">
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep({ kind: 'email' })}
              className="w-full items-center rounded-medium bg-surface-neutral-white px-comp-xlarge py-comp-large">
              <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-default">
                Get started
              </Text>
            </Pressable>
            <View className="flex-row items-center" style={{ columnGap: 4 }}>
              <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-inverse">
                Already cooking?
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep({ kind: 'email' })}
                hitSlop={8}
                style={{ borderBottomWidth: 2, borderBottomColor: ds.colors.text.inverse, paddingBottom: 2 }}>
                <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-inverse">
                  Sign in
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>
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
      canSubmit={code.length === CODE_LENGTH}
      footer={<ResendLink email={step.email} onSent={() => setCode('')} />}>
      {(error) => (
        <Field label="Code" error={error}>
          <CodeInput value={code} onChangeText={setCode} hasError={error != null} />
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
            placeholder="Sofia"
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
  // Both paths end on the welcome screen (design: household set up 5 and
  // join a household 4) – creators see it after the invite-code screen.
  const [createdWelcome, setCreatedWelcome] = useState(false);

  if (step.kind === 'choice') {
    return (
      <Screen>
        <TopBar />
        <View className="w-full px-layout-small">
          <View className="w-full gap-layout-small rounded-large bg-surface-neutral-white px-layout-small pb-layout-small pt-layout-large">
            <View className="w-full gap-layout-small">
              <Text className="font-header text-display-5 font-emphasized leading-small text-text-subtle">
                Set up your household
              </Text>
              <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
                The shared space where your family plans meals and shops together.
              </Text>
            </View>
            <View className="w-full gap-layout-small">
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
          </View>
        </View>
      </Screen>
    );
  }

  if (step.kind === 'create') {
    if (created && createdWelcome) {
      return (
        <WelcomeScreen
          household={created.household}
          onContinue={() => onHouseholdReady(created.household)}
        />
      );
    }
    if (created) {
      return (
        <Screen>
          <TopBar />
          <View className="w-full px-layout-small">
            <View className="w-full gap-layout-small rounded-large bg-surface-neutral-white px-layout-small pb-layout-small pt-layout-large">
              <View className="w-full gap-layout-small">
                <Text className="font-header text-display-5 font-emphasized leading-small text-text-subtle">
                  {created.household.name} is ready
                </Text>
                <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
                  Share this code so your family can join.
                </Text>
              </View>
              <View className="w-full gap-layout-small">
                <View className="w-full flex-row items-center rounded-large bg-surface-neutral-lightest p-layout-small">
                  {/* text/default, not text/link: the lime measures 2.01:1 on
                      this panel – below even the 3:1 large-text floor – and
                      this is the one string a user must read accurately and
                      say out loud to get their family in (audit 2026-08-02).
                      IMPROVISED – no Figma frame exists for the fixed state;
                      a designed treatment (e.g. a filled brand chip) is still
                      open in the backlog. */}
                  <Text className="flex-1 text-center font-header text-display-4 font-emphasized leading-medium text-text-default">
                    {created.inviteCode}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Copy the code"
                    hitSlop={8}
                    onPress={() => shareInvite(created.household.name, created.inviteCode)}>
                    <MaterialIcons name="content-copy" size={24} color={ds.colors.icon.default} />
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => shareInvite(created.household.name, created.inviteCode)}
                  className="w-full flex-row items-center justify-center gap-comp-xsmall rounded-medium bg-button-solid-fill-enabled py-comp-large">
                  <MaterialIcons name="ios-share" size={24} color={ds.colors.button.solid.label.enabled} />
                  <Text className="font-paragraph text-paragraph font-default leading-xsmall text-button-solid-label-enabled">
                    Share the code
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
          <View className="w-full flex-1 justify-end px-layout-small pb-layout-medium">
            <PrimaryButton label="Continue" onPress={() => setCreatedWelcome(true)} />
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

// The wordmark stacks vertically on the welcome screen (Figma "household
// set up 5"): each word subtle, each period lime, one per line.
const stackedWordmark = ['prep', 'cook', 'eat', 'repeat'];

export function WelcomeScreen({
  household,
  onContinue,
  buttonLabel = 'Start planning',
}: {
  household: Household;
  onContinue: () => void;
  buttonLabel?: string;
}) {
  return (
    <ImageBackground
      source={welcomePhoto}
      resizeMode="cover"
      className="flex-1 bg-surface-neutral-lightest">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="w-full items-start gap-layout-medium px-layout-large pt-layout-large">
          <View className="items-start">
            {stackedWordmark.map((word) => (
              <Text
                key={word}
                // 40px is the welcome-only wordmark size; inline to match the
                // design exactly (same pattern as the splash wordmark).
                className="font-header font-emphasized text-text-subtle"
                style={{ fontSize: 40, lineHeight: 40 }}>
                {word}
                <Text className="text-text-link">.</Text>
              </Text>
            ))}
          </View>
          <Text className="font-header text-display-5 font-emphasized leading-small text-text-default">
            Welcome to {household.name}
          </Text>
        </View>
        <View className="w-full flex-1 items-center justify-end gap-layout-small px-layout-small pb-layout-medium">
          <PrimaryButton label={buttonLabel} onPress={onContinue} />
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
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-neutral-lightest">
      {children}
    </SafeAreaView>
  );
}

function TopBar({ onBack }: { onBack?: () => void }) {
  return (
    <View className="mb-layout-medium w-full flex-row items-center justify-center px-layout-small pt-layout-xsmall">
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
  const scrollRef = useRef<ScrollView>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit();
    } catch (err) {
      setError(friendlyError(err));
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
        {/* The 2026-07-08 design puts the form on a white card: header,
            fields and footer live inside it; the action button stays on the
            page background below. The card scrolls when the keyboard plus
            an error banner leave too little room – otherwise the button
            would get squeezed into a labelless green bar. */}
        <ScrollView
          ref={scrollRef}
          className="w-full flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 16 }}
          // Fields, error banners and resend feedback live at the card's
          // bottom, so whenever the card outgrows the space above the
          // keyboard (small screens), keep the bottom in view (Thomas's
          // call, 2026-07-08) – the title scrolling off is fine.
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          <View className="w-full px-layout-small">
            <View className="w-full gap-layout-small rounded-large bg-surface-neutral-white px-layout-small pb-layout-small pt-layout-large">
              <View className="w-full gap-layout-small">
                <Text className="font-header text-display-5 font-emphasized leading-small text-text-subtle">
                  {title}
                </Text>
                <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
                  {subtitle}
                </Text>
              </View>
              <View className="w-full gap-layout-small">
                {children(error)}
                {footer}
              </View>
            </View>
          </View>
        </ScrollView>
        <View className="w-full px-layout-small pb-layout-medium">
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
        <View className="w-full flex-row items-start gap-comp-large rounded-medium bg-error-lightest px-comp-large py-comp-small">
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

// ⚠️ THIS MUST MATCH "Email OTP Length" IN THE SUPABASE PROJECT.
// Production was shortened from 8 to 6 on 2026-07-07. New Supabase projects
// still default to 8, and the input below silently truncates anything longer -
// so an 8-digit project makes every sign-in fail as "invalid code" with no hint
// that a dashboard toggle is the cause. That cost an hour on the dev project
// (2026-08-04); the setup checklist in docs/backups-and-local-db.md now covers
// it. Change this only alongside the setting, in every project at once.
export const CODE_LENGTH = 6;

/**
 * The sign-in code as six boxes (Figma signin 3, node 60:5200). One
 * invisible full-width TextInput holds the real value so typing, backspace
 * and iOS's code autofill from Mail keep working exactly like a plain
 * field; the boxes underneath just display its digits.
 */
function CodeInput({
  value,
  onChangeText,
  hasError,
}: {
  value: string;
  onChangeText: (code: string) => void;
  hasError?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('');
  // The box the next digit lands in gets the focused border.
  const activeIndex = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <View className="w-full">
      <View className="w-full flex-row gap-layout-small">
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <View
            key={index}
            // A box stays lit once it holds a digit (Figma signin 4: all
            // filled boxes keep the lime border), plus the box being typed
            // into while the field has focus.
            className={
              'h-[56px] flex-1 items-center justify-center rounded-medium ' +
              (hasError
                ? 'border-2 border-forms-border-error bg-forms-background-default'
                : index < value.length || (focused && index === activeIndex)
                  ? 'border-2 border-forms-border-focused bg-forms-background-active'
                  : 'border border-forms-border-enabled bg-forms-background-default')
            }>
            <Text className="font-paragraph text-paragraph text-text-default">
              {digits[index] ?? ''}
            </Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="Code"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.011 }}
      />
    </View>
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
        (disabled ? 'bg-surface-neutral-light' : 'bg-button-solid-fill-enabled')
      }>
      {busy ? (
        <ActivityIndicator color={ds.colors.button.solid.label.enabled} />
      ) : (
        <Text className="font-paragraph text-paragraph font-default leading-xsmall text-button-solid-label-enabled">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * "Send a new code" with feedback (no design for this yet – improvised in
 * the link's own spot): sending shows progress, success confirms and clears
 * the boxes for the fresh code, failure offers a retry.
 */
function ResendLink({ email, onSent }: { email: string; onSent: () => void }) {
  const { requestCode } = useAuth();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'wait' | 'failed'>('idle');
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
    },
    [],
  );

  const send = async () => {
    setStatus('sending');
    try {
      await requestCode(email);
      onSent();
      setStatus('sent');
    } catch (err) {
      // Supabase rate-limits codes ("you can only request this once every
      // 60 seconds") – that is patience, not failure, so say so.
      const message = err instanceof Error ? err.message : '';
      setStatus(/security purposes|once every|rate limit/i.test(message) ? 'wait' : 'failed');
    }
    // Either way the label reverts, so another code can be requested.
    revertTimer.current = setTimeout(() => setStatus('idle'), 8000);
  };

  if (status === 'sending') {
    return (
      <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
        Sending a new code…
      </Text>
    );
  }
  if (status === 'sent') {
    return (
      <View className="flex-row items-center gap-comp-xsmall">
        <MaterialIcons name="check" size={20} color={ds.colors.text.link} />
        <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
          New code sent – check your email
        </Text>
      </View>
    );
  }
  if (status === 'wait') {
    return (
      <Text className="font-paragraph text-paragraph font-default leading-xsmall text-text-subtle">
        A code was just sent – wait a minute, then try again
      </Text>
    );
  }
  return (
    <LinkButton
      label={status === 'failed' ? "Couldn't send – tap to retry" : 'Send a new code'}
      onPress={send}
    />
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
      className="w-full flex-row gap-comp-large rounded-large bg-surface-neutral-lightest p-layout-small">
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
