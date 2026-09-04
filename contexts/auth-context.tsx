import { Session, User } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

type AuthMode = 'loading' | 'offline' | 'authenticated' | 'guest';

type AuthContextValue = {
  mode: AuthMode;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  continueOffline: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<AuthMode>('loading');

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setMode(data.session ? 'authenticated' : 'guest');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setMode(nextSession ? 'authenticated' : 'guest');
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode,
      session,
      user: session?.user ?? null,
      isLoading: mode === 'loading',
      continueOffline: () => {
        setMode('offline');
      },
      signIn: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }
      },
      signUp: async (name: string, email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: name,
              name,
            },
          },
        });

        if (error) {
          throw error;
        }

        return { needsEmailConfirmation: !data.session };
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setMode('guest');
      },
    }),
    [mode, session]
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
