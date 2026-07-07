// Auth state + email one-time-code sign-in (decided 2026-07-07: register
// once per phone with a 6-digit emailed code, no passwords; sessions renew
// silently for as long as the app is used – no calendar expiry).
import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

interface AuthApi {
  /** undefined while the stored session is still loading at launch. */
  session: Session | null | undefined;
  /** First name from user metadata; the source of the member initial. */
  firstName: string | null;
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  saveFirstName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

// Supabase only refreshes tokens while told the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  const api = useMemo<AuthApi>(
    () => ({
      session,
      firstName:
        typeof session?.user?.user_metadata?.first_name === 'string'
          ? session.user.user_metadata.first_name
          : null,
      requestCode: async (email) => {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
      },
      verifyCode: async (email, code) => {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: code.trim(),
          type: 'email',
        });
        if (error) throw error;
      },
      saveFirstName: async (name) => {
        const first = name.replace(/\s+/g, ' ').trim();
        if (!first) throw new Error('Please enter your name');
        const { error } = await supabase.auth.updateUser({ data: { first_name: first } });
        if (error) throw error;
        // updateUser fires onAuthStateChange with the fresh metadata.
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
