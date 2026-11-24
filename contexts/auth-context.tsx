import { useNetInfo } from '@react-native-community/netinfo';
import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { clearStoredSupabaseSession, readStoredSupabaseAccount, requireSupabase, supabase } from '@/lib/supabase';
import { disableCoachPushDevice } from '@/utils/coach-push-device';

type AuthMode = 'loading' | 'offline' | 'authenticated' | 'account-offline' | 'guest';

type AuthContextValue = {
  mode: AuthMode;
  session: Session | null;
  user: User | null;
  accountId: string | null;
  isOnline: boolean;
  isLoading: boolean;
  continueOffline: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const emailAlreadyRegisteredCode = 'auth/email-already-registered';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useNetInfo();
  const isOnline = isConnected !== false;
  const [session, setSession] = useState<Session | null>(null);
  const [cachedAccount, setCachedAccount] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>(supabase ? 'loading' : 'guest');
  const signingOut = useRef(false);
  const accountId = mode === 'authenticated' ? session?.user.id ?? null : mode === 'account-offline' ? cachedAccount : null;

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let isMounted = true;
    let receivedAuthEvent = false;

    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION' || signingOut.current) return;
      receivedAuthEvent = true;
      setSession(nextSession);
      setCachedAccount(nextSession?.user.id ?? null);
      setMode((current) => current === 'offline' && event !== 'SIGNED_IN'
        ? current : nextSession ? 'authenticated' : 'guest');
    });

    async function restoreSession() {
      const savedAccount = await readStoredSupabaseAccount().catch(() => null);
      if (!isMounted || receivedAuthEvent || signingOut.current) return;
      if (savedAccount) {
        setCachedAccount(savedAccount);
        setMode((current) => current === 'loading' ? 'account-offline' : current);
      }

      const result = await client.auth.getSession().catch(() => null);
      if (!isMounted || receivedAuthEvent || signingOut.current) return;
      const nextSession = result?.data.session ?? null;
      const offlineAccount = !result || result.error ? savedAccount : null;
      setSession(nextSession);
      setCachedAccount(nextSession?.user.id ?? offlineAccount);
      setMode((current) => current === 'offline' ? current : nextSession
        ? 'authenticated' : offlineAccount ? 'account-offline' : 'guest');
    }

    void restoreSession();
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (mode !== 'account-offline' || !isOnline || !supabase) return;
    const client = supabase;
    let active = true;
    let checking = false;

    async function restoreOnlineSession() {
      if (checking || signingOut.current) return;
      checking = true;
      try {
        const { data } = await client.auth.getSession();
        if (active && !signingOut.current && data.session?.user.id === accountId) {
          setSession(data.session);
          setMode((current) => current === 'account-offline' ? 'authenticated' : current);
        }
      } catch {
        // Keep the stored account available while the authentication server is unreachable.
      } finally {
        checking = false;
      }
    }

    const interval = setInterval(restoreOnlineSession, 10_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [accountId, isOnline, mode]);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode,
      session,
      user: session?.user ?? null,
      accountId,
      isOnline,
      isLoading: mode === 'loading',
      continueOffline: () => {
        setMode('offline');
      },
      signIn: async (email: string, password: string) => {
        const { error } = await requireSupabase().auth.signInWithPassword({ email, password });

        if (error) {
          throw error;
        }
      },
      signUp: async (name: string, email: string, password: string) => {
        const { data, error } = await requireSupabase().auth.signUp({
          email,
          password,
          options: { data: { display_name: name, name } },
        });

        if (error) {
          if (isEmailAlreadyRegisteredMessage(error.message)) {
            throw createEmailAlreadyRegisteredError();
          }
          throw error;
        }

        if (data.user && data.user.identities?.length === 0) {
          throw createEmailAlreadyRegisteredError();
        }

        return { needsEmailConfirmation: !data.session };
      },
      signOut: async () => {
        if (signingOut.current) return;
        signingOut.current = true;
        try {
          if (accountId) {
            await disableCoachPushDevice(accountId).catch(() => undefined);
          }
          if (isOnline && session) {
            await supabase?.auth.signOut().catch(() => undefined);
          }
        } finally {
          try {
            await clearStoredSupabaseSession();
            setCachedAccount(null);
            setSession(null);
            setMode('guest');
          } finally {
            signingOut.current = false;
          }
        }
      },
    }),
    [accountId, isOnline, mode, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

function createEmailAlreadyRegisteredError() {
  const error = new Error('An account already exists with this email. Please login instead.');
  error.name = emailAlreadyRegisteredCode;
  return error;
}

function isEmailAlreadyRegisteredMessage(message: string) {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes('already registered') || normalizedMessage.includes('already exists');
}

export function isEmailAlreadyRegisteredError(error: unknown) {
  return error instanceof Error && error.name === emailAlreadyRegisteredCode;
}
