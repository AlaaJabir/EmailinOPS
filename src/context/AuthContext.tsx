import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  plan: string;
}

interface AuthContextType {
  user: SupabaseUser | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.NEXT_PUBLIC_API_URL ||
  'https://emailops-api.amiralucia.com'
).replace(/\/$/, '');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (currentUser: SupabaseUser, currentToken?: string) => {
    try {
      if (currentToken) {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setProfile({
              id: data.user.id,
              email: data.user.email,
              fullName: data.user.name || data.user.full_name || currentUser.user_metadata?.full_name,
              role: data.user.role || 'ADMIN',
              plan: data.user.plan || 'PRO',
            });
            return;
          }
        }
      }

      const meta = currentUser.user_metadata || {};
      setProfile({
        id: currentUser.id,
        email: currentUser.email || '',
        fullName: meta.full_name || meta.name || currentUser.email?.split('@')[0] || 'User',
        role: (meta.role as any) || 'ADMIN',
        plan: meta.plan || 'PRO',
      });
    } catch {
      const meta = currentUser.user_metadata || {};
      setProfile({
        id: currentUser.id,
        email: currentUser.email || '',
        fullName: meta.full_name || meta.name || 'User',
        role: 'ADMIN',
        plan: 'PRO',
      });
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: initSession }, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) {
        console.warn('[Supabase Auth] Session error:', sessionError.message);
      }
      setSession(initSession);
      setUser(initSession?.user ?? null);
      if (initSession?.user) {
        fetchProfile(initSession.user, initSession.access_token);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await fetchProfile(newSession.user, newSession.access_token);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    if (!isSupabaseConfigured) {
      const err = 'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not configured.';
      setError(err);
      return { success: false, error: err };
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
        return { success: false, error: authError.message };
      }

      setSession(data.session);
      setUser(data.user);
      if (data.user && data.session) {
        await fetchProfile(data.user, data.session.access_token);
      }
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to sign in. Please check your credentials.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    setError(null);
    if (!isSupabaseConfigured) {
      const err = 'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not configured.';
      setError(err);
      return { success: false, error: err };
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'ADMIN',
            plan: 'PRO',
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return { success: false, error: authError.message };
      }

      if (data.user && !data.session) {
        return {
          success: true,
          message: 'Account registered successfully! If email confirmation is enabled on your Supabase project, please check your inbox to verify your email before logging in.',
        };
      }

      setSession(data.session);
      setUser(data.user);
      if (data.user && data.session) {
        await fetchProfile(data.user, data.session.access_token);
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to register account.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[Supabase Auth] Sign out warning:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setError(null);
    }
  };

  const clearError = () => setError(null);

  const getAuthHeaders = (): Record<string, string> => {
    if (session?.access_token) {
      return {
        Authorization: `Bearer ${session.access_token}`,
      };
    }
    return {};
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        isConfigured: isSupabaseConfigured,
        login,
        register,
        logout,
        error,
        clearError,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
