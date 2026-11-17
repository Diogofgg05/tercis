import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { DEMO_PASSWORD, DEMO_PROFILES, getDemoProfile } from '../demoData';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  demoMode: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const DEMO_SESSION_KEY = 'tercis_demo_profile_id';

function demoSessionFor(profile: Profile): Session {
  return {
    access_token: `demo-token-${profile.id}`,
    refresh_token: `demo-refresh-${profile.id}`,
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    token_type: 'bearer',
    user: {
      id: profile.id,
      app_metadata: {},
      user_metadata: { full_name: profile.full_name },
      aud: 'authenticated',
      created_at: profile.created_at,
      email: profile.email,
    },
  } as Session;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const activeUserId = useRef<string | null>(null);
  const profileRequestId = useRef(0);

  async function fetchProfile(userId: string) {
    const requestId = ++profileRequestId.current;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    // Ignore an old request that resolves after sign-out or a user switch.
    if (activeUserId.current === userId && requestId === profileRequestId.current) {
      setProfile(data ?? null);
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const profileId = localStorage.getItem(DEMO_SESSION_KEY);
      const demoProfile = DEMO_PROFILES.find((item) => item.id === profileId) ?? null;
      if (demoProfile) {
        activeUserId.current = demoProfile.id;
        setProfile(demoProfile);
        setSession(demoSessionFor(demoProfile));
      }
      setLoading(false);
      return;
    }

    let disposed = false;
    let eventReceived = false;
    function applySession(nextSession: Session | null) {
      if (disposed) return;
      const nextId = nextSession?.user.id ?? null;
      const changedUser = activeUserId.current !== nextId;
      activeUserId.current = nextId;
      if (changedUser) {
        profileRequestId.current++;
        setProfile(null);
      }
      setSession(nextSession);
      if (nextSession) {
        // A prior request must never clear a fresher session's profile.
        const expectedRequestId = profileRequestId.current + 1;
        void fetchProfile(nextSession.user.id).catch(() => {
          if (!disposed && activeUserId.current === nextId
              && profileRequestId.current === expectedRequestId
              && changedUser) setProfile(null);
        }).finally(() => {
          if (!disposed) setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    }

    // INITIAL_SESSION / SIGNED_IN may arrive before getSession() finishes.
    // The most recent auth event takes priority over the bootstrap response.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!eventReceived) applySession(session);
    }).catch(() => {
      if (!eventReceived && !disposed) {
        activeUserId.current = null;
        profileRequestId.current++;
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      eventReceived = true;
      applySession(session);
    });

    const pendingRequests = profileRequestId;
    return () => {
      disposed = true;
      activeUserId.current = null;
      pendingRequests.current++;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    if (!isSupabaseConfigured) {
      const demoProfile = getDemoProfile(email, password);
      if (!demoProfile) return `Credenciais demo inválidas. Use admin@tercis.pt, tecnico@tercis.pt ou cliente@tercis.pt com a senha ${DEMO_PASSWORD}.`;
      localStorage.setItem(DEMO_SESSION_KEY, demoProfile.id);
      activeUserId.current = demoProfile.id;
      setProfile(demoProfile);
      setSession(demoSessionFor(demoProfile));
      return null;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signUp(email: string, password: string, fullName: string): Promise<string | null> {
    if (!isSupabaseConfigured) {
      return 'O registo está indisponível em modo demonstração. Utilize uma das contas de exemplo ou configure o Supabase.';
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return error?.message ?? null;
  }

  async function signOut() {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      activeUserId.current = null;
      profileRequestId.current++;
      setProfile(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (session) await fetchProfile(session.user.id);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, refreshProfile, demoMode: !isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
