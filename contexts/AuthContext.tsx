/**
 * Authentication Context
 *
 * Provides authentication state and methods throughout the app.
 * Wraps the entire app to manage user sessions.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AppUser } from '../services/supabase/authService';
import {
  getCurrentUser,
  signInWithUserCode,
  signInWithEmail,
  signOut as authSignOut,
  onAuthStateChange,
} from '../services/supabase/authService';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isTeamLeader: boolean;
  signIn: (userCodeOrEmail: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const currentUser = await getCurrentUser();
        if (mounted) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((newUser) => {
      setUser(newUser);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Sign in function (handles both user code and email)
  const signIn = async (userCodeOrEmail: string, password: string): Promise<{ error: Error | null }> => {
    setIsLoading(true);

    try {
      // Determine if input is email or user code
      const isEmail = userCodeOrEmail.includes('@');

      const result = isEmail
        ? await signInWithEmail(userCodeOrEmail, password)
        : await signInWithUserCode(userCodeOrEmail, password);

      if (result.error) {
        setIsLoading(false);
        return { error: result.error };
      }

      if (result.user) {
        setUser(result.user);
      }

      setIsLoading(false);
      return { error: null };
    } catch (error) {
      setIsLoading(false);
      return {
        error: error instanceof Error ? error : new Error('Sign in failed'),
      };
    }
  };

  // Sign out function
  const signOut = async () => {
    setIsLoading(true);

    try {
      await authSignOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isTeamLeader: user?.profile?.role === 'Team Leader',
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context
 * Must be used within AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
