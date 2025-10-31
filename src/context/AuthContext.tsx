import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  showWelcome: boolean;
  dismissWelcome: () => void;
};

const AuthCtx = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  showWelcome: false,
  dismissWelcome: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
      
      // Show welcome message only when user signs in via email confirmation (new users)
      if (event === 'SIGNED_IN' && sess?.user && !hasShownWelcome) {
        // Check if this is a fresh email confirmation (not just a regular login)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        // Check various ways Supabase might indicate email confirmation
        const isEmailConfirmation = urlParams.get('type') === 'signup' || 
                                  urlParams.get('confirmation_token') ||
                                  hashParams.get('type') === 'signup' ||
                                  hashParams.get('access_token') ||
                                  window.location.search.includes('confirmation') ||
                                  window.location.hash.includes('confirmation');
        
        if (isEmailConfirmation && sess.user.email_confirmed_at) {
          setShowWelcome(true);
          setHasShownWelcome(true);
          // Clean up the URL to remove confirmation parameters
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Auto-register OneSignal Player ID (native) when signed in
  useEffect(() => {
    if (!user || !session) return;
    let cancelled = false;

    async function attemptRegister() {
      try {
        // Prefer global despia if present (native runtime)
        const g: any = (globalThis as any);
        let pid: string | null = null;
        if (g && g.despia) {
          const d = g.despia;
          pid = d?.onesignalplayerid || null;
        } else {
          try {
            const modName = 'despia-native';
            // @ts-ignore
            const mod = await import(/* @vite-ignore */ modName);
            const despia: any = mod?.default;
            pid = despia?.onesignalplayerid || null;
          } catch {}
        }

        if (!pid || cancelled) return;

        const lsKey = `totl:last_pid:${user.id}`;
        const last = localStorage.getItem(lsKey);
        if (last === pid) return; // already registered this pid

        await fetch('/.netlify/functions/registerPlayer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ playerId: pid, platform: 'ios' }),
        }).catch(() => {});

        localStorage.setItem(lsKey, pid);
      } catch {
        /* noop */
      }
    }

    attemptRegister();

    return () => {
      cancelled = true;
    };
  }, [user?.id, session?.access_token]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  function dismissWelcome() {
    setShowWelcome(false);
    setHasShownWelcome(true);
  }

  return (
    <AuthCtx.Provider value={{ user, session, loading, signOut, showWelcome, dismissWelcome }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
